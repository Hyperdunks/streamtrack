import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { tmdbService } from '../services/tmdb.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User';

const router: RouterType = Router();

function parsePage(value: unknown): number {
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsed)) return 1;
    return Math.max(1, Math.min(500, parsed));
}

function parseType(value: unknown): 'movie' | 'tv' | 'all' {
    if (value === 'movie' || value === 'tv') {
        return value;
    }

    return 'all';
}

function parseMediaType(value: unknown, fallback: 'movie' | 'tv' = 'movie'): 'movie' | 'tv' {
    if (value === 'movie' || value === 'tv') {
        return value;
    }

    return fallback;
}

function parseTmdbId(value: unknown): number | null {
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
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

function toIsoDateString(date: Date): string {
    return date.toISOString().split('T')[0];
}

function getNextMonthDateRange(now = new Date()): { start: string; end: string } {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    const startDate = new Date(Date.UTC(year, month + 1, 1));
    const endDate = new Date(Date.UTC(year, month + 2, 0));

    return {
        start: toIsoDateString(startDate),
        end: toIsoDateString(endDate)
    };
}

async function sendContentDetails(type: 'movie' | 'tv', idValue: unknown, res: Response): Promise<void> {
    const tmdbId = parseTmdbId(idValue);
    if (!tmdbId) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
    }

    const content = await tmdbService.getDetails(tmdbId, type);

    if (!content) {
        res.status(404).json({ error: 'Content not found' });
        return;
    }

    res.json({ content });
}

async function sendSimilarContent(type: 'movie' | 'tv', idValue: unknown, pageValue: unknown, res: Response): Promise<void> {
    const tmdbId = parseTmdbId(idValue);
    if (!tmdbId) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
    }

    const page = parsePage(pageValue);
    const similar = await tmdbService.getSimilar(tmdbId, type, page);
    res.json(similar);
}

/**
 * GET /api/content/search
 * Search for movies and TV shows
 * Query params: query|q (required), page, type (optional)
 */
router.get('/search', async (req: Request, res: Response) => {
    try {
        const query = typeof req.query.query === 'string' && req.query.query.trim().length > 0
            ? req.query.query.trim()
            : typeof req.query.q === 'string'
                ? req.query.q.trim()
                : '';

        if (!query) {
            res.status(400).json({ error: 'Query parameter "query" or "q" is required' });
            return;
        }

        const pageNum = parsePage(req.query.page);
        const type = parseType(req.query.type);
        const response = await tmdbService.searchPaged(query, pageNum, type);

        res.json({
            ...response,
            query,
            type
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

/**
 * GET /api/content/movies
 * Get paginated movies using TMDB discover endpoint
 * Query params: page
 */
router.get('/movies', async (req: Request, res: Response) => {
    try {
        const page = parsePage(req.query.page);
        const providerId = parseProviderId(req.query.providerId);
        const watchRegion = parseWatchRegion(req.query.watch_region);
        const response = await tmdbService.discoverPaged('movie', {
            page,
            providerId,
            watchRegion,
            sortBy: 'popularity.desc'
        });

        res.json(response);
    } catch (error) {
        console.error('Movies error:', error);
        res.status(500).json({ error: 'Failed to get movies' });
    }
});

/**
 * GET /api/content/tv-shows
 * Get paginated TV shows using TMDB discover endpoint
 * Query params: page
 */
router.get('/tv-shows', async (req: Request, res: Response) => {
    try {
        const page = parsePage(req.query.page);
        const providerId = parseProviderId(req.query.providerId);
        const watchRegion = parseWatchRegion(req.query.watch_region);
        const response = await tmdbService.discoverPaged('tv', {
            page,
            providerId,
            watchRegion,
            sortBy: 'popularity.desc'
        });

        res.json(response);
    } catch (error) {
        console.error('TV shows error:', error);
        res.status(500).json({ error: 'Failed to get TV shows' });
    }
});

/**
 * GET /api/content/upcoming
 * Get movies or TV premieres for next calendar month
 * Query params: type (movie|tv), page
 */
router.get('/upcoming', async (req: Request, res: Response) => {
    try {
        const page = parsePage(req.query.page);
        const type = parseMediaType(req.query.type, 'movie');
        const providerId = parseProviderId(req.query.providerId);
        const watchRegion = parseWatchRegion(req.query.watch_region);
        const { start, end } = getNextMonthDateRange();

        const response = await tmdbService.discoverPaged(type, {
            page,
            providerId,
            watchRegion,
            sortBy: type === 'movie' ? 'primary_release_date.asc' : 'first_air_date.asc',
            minVoteCount: 0,
            ...(type === 'movie'
                ? { releaseDateGte: start, releaseDateLte: end }
                : { firstAirDateGte: start, firstAirDateLte: end })
        });

        res.json({ ...response, type });
    } catch (error) {
        console.error('Upcoming content error:', error);
        res.status(500).json({ error: 'Failed to get upcoming content' });
    }
});

/**
 * GET /api/content/movie/:id
 * Get full movie details with appended credits/videos/similar
 */
router.get('/movie/:id', async (req: Request, res: Response) => {
    try {
        await sendContentDetails('movie', req.params.id, res);
    } catch (error) {
        console.error('Get movie details error:', error);
        res.status(500).json({ error: 'Failed to get movie details' });
    }
});

/**
 * GET /api/content/tv/:id
 * Get full TV details with appended credits/videos/similar
 */
router.get('/tv/:id', async (req: Request, res: Response) => {
    try {
        await sendContentDetails('tv', req.params.id, res);
    } catch (error) {
        console.error('Get TV details error:', error);
        res.status(500).json({ error: 'Failed to get TV details' });
    }
});

/**
 * GET /api/content/movie/:id/similar
 * Get paginated similar movies
 */
router.get('/movie/:id/similar', async (req: Request, res: Response) => {
    try {
        await sendSimilarContent('movie', req.params.id, req.query.page, res);
    } catch (error) {
        console.error('Get similar movies error:', error);
        res.status(500).json({ error: 'Failed to get similar movies' });
    }
});

/**
 * GET /api/content/tv/:id/similar
 * Get paginated similar TV shows
 */
router.get('/tv/:id/similar', async (req: Request, res: Response) => {
    try {
        await sendSimilarContent('tv', req.params.id, req.query.page, res);
    } catch (error) {
        console.error('Get similar TV shows error:', error);
        res.status(500).json({ error: 'Failed to get similar TV shows' });
    }
});

/**
 * GET /api/content/trending
 * Get trending movies and TV shows
 * Query params: type (movie|tv|all), time (day|week)
 */
router.get('/trending', async (req: Request, res: Response) => {
    try {
        const type = (req.query.type as 'movie' | 'tv' | 'all') || 'all';
        const timeWindow = (req.query.time as 'day' | 'week') || 'week';
        const page = parsePage(req.query.page);
        const providerId = parseProviderId(req.query.providerId);
        const watchRegion = parseWatchRegion(req.query.watch_region);

        if (typeof providerId === 'number' && (type === 'movie' || type === 'tv')) {
            const filteredTrending = await tmdbService.discoverPaged(type, {
                page,
                providerId,
                watchRegion,
                sortBy: 'popularity.desc'
            });

            res.json(filteredTrending);
            return;
        }

        if (typeof providerId === 'number' && type === 'all') {
            const [movieResults, tvResults] = await Promise.all([
                tmdbService.discoverPaged('movie', {
                    page,
                    providerId,
                    watchRegion,
                    sortBy: 'popularity.desc'
                }),
                tmdbService.discoverPaged('tv', {
                    page,
                    providerId,
                    watchRegion,
                    sortBy: 'popularity.desc'
                })
            ]);

            const merged = [...movieResults.results, ...tvResults.results]
                .sort((a, b) => {
                    if (b.vote_average !== a.vote_average) {
                        return b.vote_average - a.vote_average;
                    }

                    return (b.vote_count || 0) - (a.vote_count || 0);
                })
                .slice(0, 40);

            res.json({
                results: merged,
                page,
                totalPages: Math.max(1, Math.min(movieResults.totalPages || 1, tvResults.totalPages || 1)),
                totalResults: (movieResults.totalResults || 0) + (tvResults.totalResults || 0)
            });
            return;
        }

        const results = await tmdbService.getTrending(type, timeWindow);
        res.json({
            results,
            page: 1,
            totalPages: 1,
            totalResults: results.length
        });
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ error: 'Failed to get trending content' });
    }
});

/**
 * GET /api/content/catalog
 * Get paginated catalog of movies or TV shows (used by Browse/View All)
 * Query params: type (movie|tv), page
 */
router.get('/catalog', async (req: Request, res: Response) => {
    try {
        const type = (req.query.type as 'movie' | 'tv') || 'movie';
        const page = parsePage(req.query.page);
        const providerId = parseProviderId(req.query.providerId);
        const watchRegion = parseWatchRegion(req.query.watch_region);

        const response = await tmdbService.discoverPaged(type, {
            page,
            providerId,
            watchRegion,
            sortBy: 'popularity.desc'
        });

        res.json(response);
    } catch (error) {
        console.error('Catalog error:', error);
        res.status(500).json({ error: 'Failed to get catalog' });
    }
});

/**
 * GET /api/content/anime
 * Get anime content (animation genre)
 * Query params: page
 */
router.get('/anime', async (req: Request, res: Response) => {
    try {
        const page = parsePage(req.query.page);
        const providerId = parseProviderId(req.query.providerId);
        const watchRegion = parseWatchRegion(req.query.watch_region);

        const response = await tmdbService.discoverPaged('tv', {
            genres: [16], // Animation genre ID
            page,
            providerId,
            watchRegion,
            sortBy: 'popularity.desc'
        });

        res.json(response);
    } catch (error) {
        console.error('Anime error:', error);
        res.status(500).json({ error: 'Failed to get anime' });
    }
});

/**
 * GET /api/content/trending/filtered
 * Get trending content filtered by user's services (requires auth)
 */
router.get('/trending/filtered', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { uid } = req.user!;
        const user = await User.findOne({ firebaseUid: uid });

        if (!user || user.services.length === 0) {
            // No services selected, return unfiltered trending
            const results = await tmdbService.getTrending('all', 'week');
            res.json({ results, filtered: false });
            return;
        }

        // Get trending and filter by user's services
        const trending = await tmdbService.getTrending('all', 'week');

        // Fetch watch providers for each item and filter
        const filteredResults = await Promise.all(
            trending.slice(0, 20).map(async (item) => {
                const providers = await tmdbService.getWatchProviders(item.tmdbId, item.type);
                const hasUserService = providers.some(p => user.services.includes(p));
                return hasUserService ? { ...item, watchProviders: providers } : null;
            })
        );

        res.json({
            results: filteredResults.filter(Boolean),
            filtered: true,
            userServices: user.services
        });
    } catch (error) {
        console.error('Filtered trending error:', error);
        res.status(500).json({ error: 'Failed to get filtered trending' });
    }
});

/**
 * GET /api/content/:type/:id
 * Get details for a specific movie or TV show
 * Params: type (movie|tv), id (TMDB ID)
 */
router.get('/:type/:id', async (req: Request, res: Response) => {
    try {
        const type = req.params.type as string;

        if (type !== 'movie' && type !== 'tv') {
            res.status(400).json({ error: 'Type must be "movie" or "tv"' });
            return;
        }

        await sendContentDetails(type, req.params.id, res);
    } catch (error) {
        console.error('Get content error:', error);
        res.status(500).json({ error: 'Failed to get content details' });
    }
});

/**
 * GET /api/content/:type/:id/similar
 * Get paginated similar content
 */
router.get('/:type/:id/similar', async (req: Request, res: Response) => {
    try {
        const type = req.params.type as string;
        if (type !== 'movie' && type !== 'tv') {
            res.status(400).json({ error: 'Type must be "movie" or "tv"' });
            return;
        }

        await sendSimilarContent(type, req.params.id, req.query.page, res);
    } catch (error) {
        console.error('Get similar content error:', error);
        res.status(500).json({ error: 'Failed to get similar content' });
    }
});

/**
 * GET /api/content/:type/:id/providers
 * Get watch providers for specific content
 */
router.get('/:type/:id/providers', async (req: Request, res: Response) => {
    try {
        const type = req.params.type as string;
        const id = req.params.id as string;

        if (type !== 'movie' && type !== 'tv') {
            res.status(400).json({ error: 'Type must be "movie" or "tv"' });
            return;
        }

        const tmdbId = parseInt(id, 10);
        if (isNaN(tmdbId)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }

        const providers = await tmdbService.getWatchProviders(tmdbId, type as 'movie' | 'tv');
        res.json({ providers, tmdbId, type });
    } catch (error) {
        console.error('Get providers error:', error);
        res.status(500).json({ error: 'Failed to get watch providers' });
    }
});

export default router;
