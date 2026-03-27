import { Router, Response } from 'express';
import type { Router as RouterType } from 'express';
import { vibeService } from '../services/vibe.service';
import { tmdbService } from '../services/tmdb.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User';

const router: RouterType = Router();

function parseLocalHour(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    const parsed = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsed)) {
        return undefined;
    }

    return Math.max(0, Math.min(23, parsed));
}

function parseProviderId(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    const parsed = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return undefined;
    }

    return parsed;
}

function parseWatchRegion(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return 'IN';
    }

    return value.trim().toUpperCase();
}

/**
 * GET /api/discover/vibes
 * Get list of all available vibes (predefined + user's custom if authenticated)
 */
router.get('/vibes', async (req: AuthRequest, res: Response) => {
    const predefinedVibes = vibeService.getVibes();

    // If user is authenticated, include their custom vibes
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const { verifyIdToken } = await import('../services/firebase.service');
            const token = authHeader.split(' ')[1];
            const decoded = await verifyIdToken(token);
            if (decoded) {
                const user = await User.findOne({ firebaseUid: decoded.uid });
                const customVibes = (user?.customVibes || []).map(cv => ({
                    id: `custom-${cv.id}`,
                    name: cv.name,
                    icon: 'sparkles',
                    color: cv.color || '#6366f1',
                    description: `Custom vibe: ${cv.name}`,
                    genres: cv.genres,
                    minRating: cv.minRating,
                    isCustom: true
                }));
                res.json({ vibes: predefinedVibes, customVibes });
                return;
            }
        } catch {
            // Silent fail - just return predefined vibes
        }
    }

    res.json({ vibes: predefinedVibes, customVibes: [] }); // Fallback
});

/**
 * GET /api/discover/recommendations
 * Get recommendations based on user's genres (onboarding)
 */
router.get('/recommendations', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { uid } = req.user!;
        const user = await User.findOne({ firebaseUid: uid });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const recommendations = await vibeService.getOnboardingRecommendations(
            user.genres || [],
            user.services || []
        );

        res.json({ recommendations });
    } catch (error) {
        console.error('Get recommendations error:', error);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});

/**
 * GET /api/discover/genres
 * Get list of all available genres from TMDB
 */
router.get('/genres', async (_req, res: Response) => {
    try {
        const genres = await tmdbService.getGenres();
        res.json({ genres });
    } catch (error) {
        console.error('Get genres error:', error);
        res.status(500).json({ error: 'Failed to get genres' });
    }
});

/**
 * GET /api/discover
 * Discover content by vibe (supports predefined vibes and custom vibes with 'custom-{id}' format)
 * Query params: vibe (required), type (movie|tv), page
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { vibe, type, page } = req.query;

        if (!vibe || typeof vibe !== 'string') {
            res.status(400).json({ error: 'Query parameter "vibe" is required' });
            return;
        }

        // Try to resolve authenticated user context, but allow guest discovery.
        let user = null;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            try {
                const { verifyIdToken } = await import('../services/firebase.service');
                const token = authHeader.split(' ')[1];
                const decoded = await verifyIdToken(token);
                if (decoded) {
                    user = await User.findOne({ firebaseUid: decoded.uid });
                }
            } catch {
                // Silent fail - continue as guest
            }
        }

        const userServices = user?.services || [];

        const contentType = (type as 'movie' | 'tv') || 'movie';
        const pageNum = parseInt(String(page)) || 1;
        const providerId = parseProviderId(req.query.providerId);
        const watchRegion = parseWatchRegion(req.query.watch_region);

        // Check if it's a custom vibe (format: custom-{id})
        if (vibe.startsWith('custom-')) {
            if (!user) {
                res.status(401).json({ error: 'Authentication required for custom vibes' });
                return;
            }

            const customVibeId = vibe.replace('custom-', '');
            const customVibe = user?.customVibes?.find(cv => cv.id === customVibeId);

            if (!customVibe) {
                res.status(400).json({ error: 'Custom vibe not found' });
                return;
            }

            const { results, vibe: vibeInfo } = await vibeService.discoverByCustomVibe(
                customVibe,
                userServices,
                contentType,
                pageNum,
                providerId,
                watchRegion
            );

            res.json({
                results,
                vibe: vibeInfo,
                type: contentType,
                page: pageNum,
                userServices,
                filtered: userServices.length > 0 || typeof providerId === 'number',
                isCustom: true
            });
            return;
        }

        // Predefined vibe
        const { results, vibe: vibeInfo } = await vibeService.discoverByVibe(
            vibe,
            userServices,
            contentType,
            pageNum,
            providerId,
            watchRegion
        );

        if (!vibeInfo) {
            res.status(400).json({
                error: 'Invalid vibe',
                available: vibeService.getVibes().map(v => v.id)
            });
            return;
        }

        res.json({
            results,
            vibe: vibeInfo,
            type: contentType,
            page: pageNum,
            userServices,
            filtered: userServices.length > 0 || typeof providerId === 'number'
        });
    } catch (error) {
        console.error('Discover error:', error);
        res.status(500).json({ error: 'Discovery failed' });
    }
});

/**
 * GET /api/discover/tonight
 * Get tonight's pick recommendation (works without auth for public access)
 */
router.get('/tonight', async (req: AuthRequest, res: Response) => {
    try {
        const localHour = parseLocalHour(req.query.localHour);

        // Try to get user if authenticated, but don't require it
        let userServices: string[] = [];
        let watchlistTmdbIds: number[] = [];
        
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            try {
                const { verifyIdToken } = await import('../services/firebase.service');
                const token = authHeader.split(' ')[1];
                const decoded = await verifyIdToken(token);
                if (decoded) {
                    const user = await User.findOne({ firebaseUid: decoded.uid });
                    if (user) {
                        userServices = user.services || [];
                        watchlistTmdbIds = user.watchlist
                            .map(item => parseInt(item.contentId))
                            .filter(id => !isNaN(id));
                    }
                }
            } catch {
                // Silent fail - proceed without user context
            }
        }

        const { pick, options, reason, slot, vibeId, vibeName, prioritizedBySubscriptions } = await vibeService.getTonightsPick(
            userServices,
            watchlistTmdbIds,
            { localHour }
        );

        if (!pick) {
            res.json({
                pick: null,
                reason: 'No recommendations available',
                suggestion: 'Try adding more streaming services',
                options,
                slot,
                vibeId,
                vibeName,
                prioritizedBySubscriptions
            });
            return;
        }

        res.json({ pick, options, reason, slot, vibeId, vibeName, prioritizedBySubscriptions });
    } catch (error) {
        console.error('Tonight\'s pick error:', error);
        res.status(500).json({ error: 'Failed to get tonight\'s pick' });
    }
});

// ============================================================
// CUSTOM VIBES API
// ============================================================

/**
 * GET /api/discover/vibes/custom
 * Get user's custom vibes
 */
router.get('/vibes/custom', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { uid } = req.user!;
        const user = await User.findOne({ firebaseUid: uid });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({ customVibes: user.customVibes || [] });
    } catch (error) {
        console.error('Get custom vibes error:', error);
        res.status(500).json({ error: 'Failed to get custom vibes' });
    }
});

/**
 * POST /api/discover/vibes/custom
 * Create a new custom vibe (max 5)
 */
router.post('/vibes/custom', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { uid } = req.user!;
        const { name, genres, minRating, color } = req.body;

        // Validation
        if (!name || typeof name !== 'string' || name.length > 50) {
            res.status(400).json({ error: 'Name is required and must be 50 characters or less' });
            return;
        }
        if (!genres || !Array.isArray(genres) || genres.length === 0 || !genres.every(g => Number.isFinite(g) && Number.isInteger(g))) {
            res.status(400).json({ error: 'At least one genre is required and all must be integers' });
            return;
        }

        if (minRating !== undefined) {
            const numRating = Number(minRating);
            if (isNaN(numRating) || numRating < 0 || numRating > 10) {
                res.status(400).json({ error: 'MinRating must be a number between 0 and 10' });
                return;
            }
        }

        if (color !== undefined && (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color))) {
            res.status(400).json({ error: 'Color must be a valid hex code (e.g. #FFFFFF)' });
            return;
        }

        const user = await User.findOne({ firebaseUid: uid });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Check max limit
        if ((user.customVibes?.length || 0) >= 5) {
            res.status(400).json({ error: 'Maximum 5 custom vibes allowed' });
            return;
        }

        // Generate unique ID
        const newVibe = {
            id: `cv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            name: name.trim(),
            genres: genres.map((g: number) => Number(g)),
            minRating: minRating !== undefined ? Number(minRating) : undefined,
            color: color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : undefined,
            createdAt: new Date()
        };

        user.customVibes = [...(user.customVibes || []), newVibe];
        await user.save();

        console.log('✅ Custom vibe created:', newVibe.name, 'for user:', user.email);
        res.status(201).json({ customVibe: newVibe });
    } catch (error) {
        console.error('Create custom vibe error:', error);
        res.status(500).json({ error: 'Failed to create custom vibe' });
    }
});

/**
 * PUT /api/discover/vibes/custom/:id
 * Update a custom vibe
 */
router.put('/vibes/custom/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { uid } = req.user!;
        const { id } = req.params;
        const { name, genres, minRating, color } = req.body;

        if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 50)) {
            res.status(400).json({ error: 'Name must be a string up to 50 characters' });
            return;
        }

        if (genres !== undefined && (!Array.isArray(genres) || genres.length === 0 || !genres.every(g => Number.isFinite(g) && Number.isInteger(g)))) {
            res.status(400).json({ error: 'Genres must be a non-empty array of integers' });
            return;
        }

        if (minRating !== undefined) {
            const numRating = Number(minRating);
            if (isNaN(numRating) || numRating < 0 || numRating > 10) {
                res.status(400).json({ error: 'MinRating must be a number between 0 and 10' });
                return;
            }
        }

        if (color !== undefined && (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color))) {
            res.status(400).json({ error: 'Color must be a valid hex code (e.g. #FFFFFF)' });
            return;
        }

        const user = await User.findOne({ firebaseUid: uid });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const vibeIndex = user.customVibes?.findIndex(v => v.id === id) ?? -1;
        if (vibeIndex === -1) {
            res.status(404).json({ error: 'Custom vibe not found' });
            return;
        }

        // Update fields
        const existingVibe = user.customVibes[vibeIndex];
        user.customVibes[vibeIndex] = {
            ...existingVibe,
            name: name?.trim() || existingVibe.name,
            genres: (genres && Array.isArray(genres) && genres.length > 0)
                ? genres.map((g: number) => Number(g))
                : existingVibe.genres,
            minRating: minRating !== undefined ? Number(minRating) : existingVibe.minRating,
            color: color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : existingVibe.color
        };

        await user.save();

        console.log('✅ Custom vibe updated:', id);
        res.json({ customVibe: user.customVibes[vibeIndex] });
    } catch (error) {
        console.error('Update custom vibe error:', error);
        res.status(500).json({ error: 'Failed to update custom vibe' });
    }
});

/**
 * DELETE /api/discover/vibes/custom/:id
 * Delete a custom vibe
 */
router.delete('/vibes/custom/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { uid } = req.user!;
        const { id } = req.params;

        const user = await User.findOne({ firebaseUid: uid });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const vibeIndex = user.customVibes?.findIndex(v => v.id === id) ?? -1;
        if (vibeIndex === -1) {
            res.status(404).json({ error: 'Custom vibe not found' });
            return;
        }

        user.customVibes.splice(vibeIndex, 1);
        await user.save();

        console.log('✅ Custom vibe deleted:', id);
        res.json({ message: 'Custom vibe deleted' });
    } catch (error) {
        console.error('Delete custom vibe error:', error);
        res.status(500).json({ error: 'Failed to delete custom vibe' });
    }
});

export default router;

