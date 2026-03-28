import { Router, Response } from 'express';
import type { Router as RouterType } from 'express';
import { User, IWatchlistItem } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router: RouterType = Router();

/**
 * GET /api/watchlist
 * Returns the user's watchlist, optionally filtered by status
 * Query: ?status=want|watching|watched
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { uid } = req.user!;
        const { status } = req.query;

        const user = await User.findOne({ firebaseUid: uid });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        let watchlist = user.watchlist;

        if (status && typeof status === 'string') {
            watchlist = watchlist.filter(item => item.status === status);
        }

        // Sort by addedAt desc (newest first)
        watchlist.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

        res.json({ watchlist });
    } catch (error) {
        console.error('Error getting watchlist:', error);
        res.status(500).json({ error: 'Failed to get watchlist' });
    }
});

/**
 * GET /api/watchlist/stats
 * Returns statistics about the user's watchlist
 */
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { uid } = req.user!;
        const user = await User.findOne({ firebaseUid: uid });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const watchlist = user.watchlist;

        const stats = {
            total: watchlist.length,
            byStatus: {
                want: watchlist.filter(i => i.status === 'want').length,
                watching: watchlist.filter(i => i.status === 'watching').length,
                watched: watchlist.filter(i => i.status === 'watched').length
            },
            byType: {
                movie: watchlist.filter(i => i.type === 'movie').length,
                tv: watchlist.filter(i => i.type === 'tv').length
            }
        };

        res.json({ stats });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

/**
 * POST /api/watchlist
 * Adds an item to the user's watchlist
 * Body: { contentId, title, type, posterPath, status?, rating?, notes? }
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { uid } = req.user!;
        const { contentId, title, type, posterPath, genre, status, rating, notes } = req.body;

        let normalizedRating: number | undefined = undefined;

        if (!contentId || !title || !type) {
            res.status(400).json({ error: 'Missing required fields: contentId, title, type' });
            return;
        }

        if (type !== 'movie' && type !== 'tv') {
            res.status(400).json({ error: 'Type must be "movie" or "tv"' });
            return;
        }

        if (status !== undefined && !['want', 'watching', 'watched'].includes(status)) {
            res.status(400).json({ error: 'Status must be "want", "watching", or "watched"' });
            return;
        }

        if (rating !== undefined) {
            const numRating = Number(rating);
            if (isNaN(numRating) || numRating < 0 || numRating > 10) {
                res.status(400).json({ error: 'Rating must be a number between 0 and 10' });
                return;
            }
            normalizedRating = numRating;
        }

        if (notes !== undefined && typeof notes !== 'string') {
            res.status(400).json({ error: 'Notes must be a string' });
            return;
        }

        if (genre !== undefined && typeof genre !== 'string') {
            res.status(400).json({ error: 'Genre must be a string' });
            return;
        }

        const user = await User.findOne({ firebaseUid: uid });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Check if already exists
        const existingIndex = user.watchlist.findIndex(item => item.contentId === contentId);
        if (existingIndex !== -1) {
            res.status(409).json({ error: 'Item already in watchlist' });
            return;
        }

        const newItem: IWatchlistItem = {
            contentId,
            title,
            type,
            posterPath,
            genre: typeof genre === 'string' ? genre.trim() || undefined : undefined,
            status: status || 'want',
            rating: normalizedRating,
            notes,
            addedAt: new Date(),
            updatedAt: new Date()
        };

        user.watchlist.push(newItem);
        await user.save();

        res.status(201).json({ message: 'Added to watchlist', item: newItem });
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        res.status(500).json({ error: 'Failed to add to watchlist' });
    }
});

/**
 * PUT /api/watchlist/:contentId
 * Updates an item in the user's watchlist
 * Body: { status?, rating?, notes? }
 */
router.put('/:contentId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { uid } = req.user!;
        const { contentId } = req.params;
        const updates = req.body;

        let normalizedRating: number | undefined = undefined;

        if (updates.status !== undefined && !['want', 'watching', 'watched'].includes(updates.status)) {
            res.status(400).json({ error: 'Status must be "want", "watching", or "watched"' });
            return;
        }

        if (updates.rating !== undefined) {
            const numRating = Number(updates.rating);
            if (isNaN(numRating) || numRating < 0 || numRating > 10) {
                res.status(400).json({ error: 'Rating must be a number between 0 and 10' });
                return;
            }
            normalizedRating = numRating;
        }

        if (updates.notes !== undefined && typeof updates.notes !== 'string') {
            res.status(400).json({ error: 'Notes must be a string' });
            return;
        }

        const user = await User.findOne({ firebaseUid: uid });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const item = user.watchlist.find(i => i.contentId === contentId);
        if (!item) {
            res.status(404).json({ error: 'Item not in watchlist' });
            return;
        }

        // Apply updates
        if (updates.status) item.status = updates.status;
        if (normalizedRating !== undefined) item.rating = normalizedRating;
        if (updates.notes !== undefined) item.notes = updates.notes;
        item.updatedAt = new Date();

        await user.save();

        res.json({ message: 'Watchlist item updated', item });
    } catch (error) {
        console.error('Error updating watchlist item:', error);
        res.status(500).json({ error: 'Failed to update watchlist item' });
    }
});

/**
 * DELETE /api/watchlist/:contentId
 * Removes an item from the user's watchlist
 */
router.delete('/:contentId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { uid } = req.user!;
        const { contentId } = req.params;

        const user = await User.findOne({ firebaseUid: uid });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const initialLength = user.watchlist.length;
        user.watchlist = user.watchlist.filter(item => item.contentId !== contentId);

        if (user.watchlist.length === initialLength) {
            res.status(404).json({ error: 'Item not in watchlist' });
            return;
        }

        await user.save();

        res.json({ message: 'Removed from watchlist' });
    } catch (error) {
        console.error('Error removing from watchlist:', error);
        res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
});

export default router;



