/**
 * TMDB Service - Handles all TMDB API interactions with caching
 */

// Simple LRU Cache implementation
class LRUCache<T> {
    private cache = new Map<string, { value: T; timestamp: number }>();
    private maxSize: number;
    private ttlMs: number;

    constructor(maxSize = 100, ttlMs = 10 * 60 * 1000) { // 10 min default TTL
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }

    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        // Check TTL
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return undefined;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.value;
    }

    set(key: string, value: T): void {
        // Remove if exists (to update position)
        this.cache.delete(key);

        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest) this.cache.delete(oldest);
        }

        this.cache.set(key, { value, timestamp: Date.now() });
    }

    clear(): void {
        this.cache.clear();
    }
}

// Response types
export interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string;
    vote_average: number;
    vote_count: number;
    genre_ids: number[];
    media_type?: string;
}

export interface TMDBTVShow {
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    first_air_date: string;
    vote_average: number;
    vote_count: number;
    genre_ids: number[];
    media_type?: string;
}

export interface TMDBSearchResult {
    page: number;
    total_pages: number;
    total_results: number;
    results: (TMDBMovie | TMDBTVShow)[];
}

export interface PagedContentResult {
    results: ContentItem[];
    page: number;
    totalPages: number;
    totalResults: number;
}

interface DiscoverOptions {
    genres?: number[];
    genreMode?: 'and' | 'or';
    providers?: number[];
    providerId?: number;
    watchRegion?: string;
    minRating?: number;
    minVoteCount?: number;
    page?: number;
    sortBy?: string;
    releaseDateGte?: string;
    releaseDateLte?: string;
    firstAirDateGte?: string;
    firstAirDateLte?: string;
}

export interface CastMember {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
    profile_url: string | null;
}

export interface TrailerInfo {
    key: string;
    name: string;
    site: string;
    type: string;
    url: string;
    embedUrl: string;
}

export interface SimilarRecommendations {
    results: ContentItem[];
    page: number;
    totalPages: number;
    totalResults: number;
}

export interface TMDBWatchProvider {
    logo_path: string;
    provider_id: number;
    provider_name: string;
}

export interface TMDBWatchProviders {
    link?: string;
    flatrate?: TMDBWatchProvider[];
    rent?: TMDBWatchProvider[];
    buy?: TMDBWatchProvider[];
}

export interface TMDBContentDetails {
    id: number;
    title?: string;         // Movie
    name?: string;          // TV
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string;  // Movie
    first_air_date?: string; // TV
    vote_average: number;
    vote_count: number;
    genres: { id: number; name: string }[];
    runtime?: number;       // Movie
    episode_run_time?: number[]; // TV
    status: string;
    tagline?: string;
    watchProviders?: TMDBWatchProviders;
    credits?: {
        cast: {
            id: number;
            name: string;
            character?: string;
            profile_path: string | null;
        }[];
    };
    videos?: {
        results: {
            key: string;
            name: string;
            site: string;
            type: string;
            official?: boolean;
        }[];
    };
    similar?: {
        page: number;
        total_pages: number;
        total_results: number;
        results: (TMDBMovie | TMDBTVShow)[];
    };
}

// Normalized content format for frontend
export interface ContentItem {
    id: string;
    tmdbId: number;
    type: 'movie' | 'tv';
    title: string;
    name?: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string;
    first_air_date?: string;
    vote_average: number;
    vote_count: number;
    genre_ids: number[];
    genres?: string[];
    runtime?: number;
    watchProviders?: string[];
    castMembers?: CastMember[];
    trailer?: TrailerInfo | null;
    similar?: SimilarRecommendations;
}

class TMDBService {
    private apiKey: string;
    private readAccessToken: string;
    private effectiveToken: string;
    private isV4Token: boolean;
    private baseUrl = 'https://api.themoviedb.org/3';
    private imageBaseUrl = 'https://image.tmdb.org/t/p';
    private cache = new LRUCache<any>(200);
    private region = 'IN'; // Default region for watch providers

    private providerAliasMap: Record<number, number[]> = {
        9: [9, 119],
        119: [9, 119],
        337: [337, 122],
        122: [337, 122]
    };

    constructor() {
        this.apiKey = this.normalizeToken(process.env.TMDB_API_KEY);
        this.readAccessToken = this.normalizeToken(process.env.TMDB_READ_ACCESS_TOKEN);

        const hasValidReadAccessToken = this.readAccessToken ? this.isV4TokenFormat(this.readAccessToken) : false;

        if (this.readAccessToken && !hasValidReadAccessToken) {
            console.warn('⚠️ TMDB_READ_ACCESS_TOKEN format looks invalid; expected JWT format.');
        }

        if (hasValidReadAccessToken) {
            this.effectiveToken = this.readAccessToken;
            this.isV4Token = true;
        } else {
            this.effectiveToken = this.apiKey;
            this.isV4Token = false;
        }

        if (!this.effectiveToken) {
            console.warn('⚠️ TMDB_API_KEY or TMDB_READ_ACCESS_TOKEN not set - content features will not work');
        }
    }

    private normalizeToken(value: string | undefined): string {
        if (!value) return '';

        let token = value.trim();
        token = token.replace(/^Bearer\s+/i, '');
        token = token.replace(/^['"](.*)['"]$/, '$1').trim();

        return token;
    }

    private isV4TokenFormat(token: string): boolean {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        return parts.every((part) => part.length > 0 && /^[A-Za-z0-9_-]+$/.test(part));
    }

    private normalizePage(page?: number): number {
        if (!page || !Number.isFinite(page)) return 1;
        return Math.max(1, Math.min(500, Math.floor(page)));
    }

    private async fetchWithRetry<T>(url: string, options: RequestInit, maxRetries = 3): Promise<T> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🎬 TMDB API Request [${attempt}/${maxRetries}]: ${options.method || 'GET'} ${url}`);
                
                const response = await fetch(url, {
                    ...options,
                    signal: AbortSignal.timeout(10000) // 10-second timeout
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    const error = new Error(`TMDB API error: ${response.status} ${response.statusText} - ${errorText}`);
                    console.error(`❌ TMDB API Error [${attempt}/${maxRetries}]:`, {
                        status: response.status,
                        statusText: response.statusText,
                        url,
                        errorText
                    });
                    throw error;
                }

                console.log(`✅ TMDB API Success [${attempt}/${maxRetries}]: ${response.status} ${url}`);
                return await response.json() as T;
            } catch (error) {
                console.error(`❌ TMDB Fetch Error [${attempt}/${maxRetries}]:`, {
                    url,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });

                if (attempt === maxRetries) {
                    throw new Error(`TMDB API failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
                }

                // Exponential backoff: 500ms, 1000ms, 2000ms
                const delay = 500 * Math.pow(2, attempt - 1);
                console.log(`⏳ Retrying TMDB request in ${delay}ms... [${attempt}/${maxRetries}]`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw new Error('TMDB fetchWithRetry failed unexpectedly');
    }

    private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
        const queryParams = new URLSearchParams(params);
        const effectiveToken = this.effectiveToken;

        if (!effectiveToken) {
            throw new Error('TMDB credentials are not configured. Set TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY.');
        }

        // For v3 keys, pass as query param; for v4 tokens, use Authorization header
        if (!this.isV4Token) {
            queryParams.set('api_key', effectiveToken);
        }

        const url = `${this.baseUrl}${endpoint}?${queryParams}`;
        const cacheKey = url;

        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached) {
            console.log(`🎯 TMDB Cache Hit: ${endpoint}`);
            return cached as T;
        }

        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        if (this.isV4Token) {
            headers['Authorization'] = `Bearer ${effectiveToken}`;
        }

        const data = await this.fetchWithRetry<T>(url, { headers });
        this.cache.set(cacheKey, data);
        return data;
    }

    /**
     * Search for movies and TV shows
     */
    async search(
        query: string,
        page = 1,
        type: 'movie' | 'tv' | 'all' = 'all'
    ): Promise<ContentItem[]> {
        const response = await this.searchPaged(query, page, type);
        return response.results;
    }

    async searchPaged(
        query: string,
        page = 1,
        type: 'movie' | 'tv' | 'all' = 'all'
    ): Promise<PagedContentResult> {
        const normalizedPage = this.normalizePage(page);
        const endpoint = type === 'all' ? '/search/multi' : `/search/${type}`;
        const data = await this.fetch<TMDBSearchResult>(endpoint, {
            query,
            page: String(normalizedPage),
            include_adult: 'false'
        });

        const results = type === 'all'
            ? data.results
                .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
                .map(item => this.normalizeResult(item))
            : data.results.map(item => this.normalizeResult(item, type));

        return {
            results,
            page: data.page,
            totalPages: data.total_pages,
            totalResults: data.total_results
        };
    }

    /**
     * Get content details by ID
     */
    async getDetails(id: number, type: 'movie' | 'tv'): Promise<ContentItem | null> {
        try {
            const [details, providers] = await Promise.all([
                this.fetch<TMDBContentDetails>(`/${type}/${id}`, {
                    append_to_response: 'credits,videos'
                }),
                this.getWatchProviders(id, type)
            ]);

            return this.normalizeDetails(details, type, providers);
        } catch (error) {
            console.error(`Error fetching ${type} ${id}:`, error);
            return null;
        }
    }

    /**
     * Get watch providers for content
     */
    async getWatchProviders(id: number, type: 'movie' | 'tv'): Promise<string[]> {
        try {
            const data = await this.fetch<{ results: Record<string, TMDBWatchProviders> }>(
                `/${type}/${id}/watch/providers`
            );

            const regionData = data.results[this.region];
            if (!regionData?.flatrate) return [];

            // Map provider IDs to our internal service IDs
            return regionData.flatrate
                .map(p => this.mapProviderId(p.provider_id))
                .filter((id): id is string => id !== null);
        } catch {
            return [];
        }
    }

    /**
     * Discover content with filters
     */
    async discover(
        type: 'movie' | 'tv',
        options: DiscoverOptions = {}
    ): Promise<ContentItem[]> {
        const response = await this.discoverPaged(type, options);
        return response.results;
    }

    async getSimilar(id: number, type: 'movie' | 'tv', page = 1): Promise<PagedContentResult> {
        const normalizedPage = this.normalizePage(page);
        const data = await this.fetch<TMDBSearchResult>(`/${type}/${id}/similar`, {
            page: String(normalizedPage)
        });

        return {
            results: data.results.map(item => this.normalizeResult(item, type)),
            page: data.page,
            totalPages: data.total_pages,
            totalResults: data.total_results
        };
    }

    async discoverPaged(
        type: 'movie' | 'tv',
        options: DiscoverOptions = {}
    ): Promise<PagedContentResult> {
        const normalizedPage = this.normalizePage(options.page);
        const watchRegion = options.watchRegion || this.region;
        const params: Record<string, string> = {
            page: String(normalizedPage),
            sort_by: options.sortBy || 'popularity.desc',
            watch_region: watchRegion
        };

        const minVoteCount = options.minVoteCount ?? 50;
        if (minVoteCount > 0) {
            params['vote_count.gte'] = String(minVoteCount);
        }

        if (options.genres?.length) {
            params.with_genres = options.genreMode === 'or'
                ? options.genres.join('|')
                : options.genres.join(',');
        }
        if (typeof options.providerId === 'number') {
            params.with_watch_providers = this.expandProviderIds(options.providerId).join('|');
        } else if (options.providers?.length) {
            params.with_watch_providers = options.providers.join('|');
        }
        if (options.minRating) {
            params['vote_average.gte'] = String(options.minRating);
        }
        if (options.releaseDateGte) {
            params['primary_release_date.gte'] = options.releaseDateGte;
        }
        if (options.releaseDateLte) {
            params['primary_release_date.lte'] = options.releaseDateLte;
        }
        if (options.firstAirDateGte) {
            params['first_air_date.gte'] = options.firstAirDateGte;
        }
        if (options.firstAirDateLte) {
            params['first_air_date.lte'] = options.firstAirDateLte;
        }

        const data = await this.fetch<TMDBSearchResult>(`/discover/${type}`, params);
        return {
            results: data.results.map(item => this.normalizeResult(item, type)),
            page: data.page,
            totalPages: data.total_pages,
            totalResults: data.total_results
        };
    }

    /**
     * Get trending content
     */
    async getTrending(type: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'week'): Promise<ContentItem[]> {
        const data = await this.fetch<TMDBSearchResult>(`/trending/${type}/${timeWindow}`);
        return data.results.map(item => this.normalizeResult(item));
    }

    /**
     * Get genres list (movies + tv combined)
     */
    async getGenres(): Promise<{ id: number; name: string }[]> {
        const cacheKey = 'tmdb_genres';
        const cached = this.cache.get(cacheKey);
        if (cached) return cached as { id: number; name: string }[];

        try {
            const [movieGenres, tvGenres] = await Promise.all([
                this.fetch<{ genres: { id: number; name: string }[] }>('/genre/movie/list'),
                this.fetch<{ genres: { id: number; name: string }[] }>('/genre/tv/list')
            ]);

            // Merge and deduplicate
            const genreMap = new Map<number, string>();
            movieGenres.genres.forEach(g => genreMap.set(g.id, g.name));
            tvGenres.genres.forEach(g => genreMap.set(g.id, g.name));

            const genres = Array.from(genreMap.entries()).map(([id, name]) => ({ id, name }));

            // Sort alphabetically
            genres.sort((a, b) => a.name.localeCompare(b.name));

            this.cache.set(cacheKey, genres);
            return genres;
        } catch (error) {
            console.error('Error fetching genres:', error);
            return [];
        }
    }

    /**
     * Normalize TMDB search result to our format
     */
    private normalizeResult(item: TMDBMovie | TMDBTVShow, forceType?: 'movie' | 'tv'): ContentItem {
        const isMovie = forceType === 'movie' || ('title' in item);
        const type = forceType || (isMovie ? 'movie' : 'tv');

        return {
            id: `${type}-${item.id}`,
            tmdbId: item.id,
            type,
            title: isMovie ? (item as TMDBMovie).title : (item as TMDBTVShow).name,
            name: !isMovie ? (item as TMDBTVShow).name : undefined,
            overview: item.overview,
            poster_path: item.poster_path ? `${this.imageBaseUrl}/w500${item.poster_path}` : null,
            backdrop_path: item.backdrop_path ? `${this.imageBaseUrl}/w1280${item.backdrop_path}` : null,
            release_date: isMovie ? (item as TMDBMovie).release_date : undefined,
            first_air_date: !isMovie ? (item as TMDBTVShow).first_air_date : undefined,
            vote_average: Math.round(item.vote_average * 10) / 10,
            vote_count: item.vote_count,
            genre_ids: item.genre_ids
        };
    }

    /**
     * Normalize TMDB details to our format
     */
    private normalizeDetails(
        item: TMDBContentDetails,
        type: 'movie' | 'tv',
        watchProviders: string[]
    ): ContentItem {
        const isMovie = type === 'movie';
        const castMembers: CastMember[] = (item.credits?.cast || [])
            .slice(0, 5)
            .map((member) => ({
                id: member.id,
                name: member.name,
                character: member.character || '',
                profile_path: member.profile_path,
                profile_url: member.profile_path ? `${this.imageBaseUrl}/w185${member.profile_path}` : null
            }));

        const trailer = this.extractTrailer(item.videos?.results || []);
        const similarData = item.similar
            ? {
                results: item.similar.results.map((result) => this.normalizeResult(result, type)),
                page: item.similar.page,
                totalPages: item.similar.total_pages,
                totalResults: item.similar.total_results
            }
            : undefined;

        return {
            id: `${type}-${item.id}`,
            tmdbId: item.id,
            type,
            title: isMovie ? item.title! : item.name!,
            name: !isMovie ? item.name : undefined,
            overview: item.overview,
            poster_path: item.poster_path ? `${this.imageBaseUrl}/w500${item.poster_path}` : null,
            backdrop_path: item.backdrop_path ? `${this.imageBaseUrl}/w1280${item.backdrop_path}` : null,
            release_date: isMovie ? item.release_date : undefined,
            first_air_date: !isMovie ? item.first_air_date : undefined,
            vote_average: Math.round(item.vote_average * 10) / 10,
            vote_count: item.vote_count,
            genre_ids: item.genres.map(g => g.id),
            genres: item.genres.map(g => g.name),
            runtime: isMovie ? item.runtime : item.episode_run_time?.[0],
            watchProviders,
            castMembers,
            trailer,
            similar: similarData
        };
    }

    private extractTrailer(videos: {
        key: string;
        name: string;
        site: string;
        type: string;
        official?: boolean;
    }[]): TrailerInfo | null {
        const youtubeVideos = videos.filter((video) => video.site === 'YouTube');
        if (youtubeVideos.length === 0) {
            return null;
        }

        const preferred =
            youtubeVideos.find((video) => video.type === 'Trailer' && video.official) ||
            youtubeVideos.find((video) => video.type === 'Trailer') ||
            youtubeVideos.find((video) => video.type === 'Teaser') ||
            youtubeVideos[0];

        return {
            key: preferred.key,
            name: preferred.name,
            site: preferred.site,
            type: preferred.type,
            url: `https://www.youtube.com/watch?v=${preferred.key}`,
            embedUrl: `https://www.youtube.com/embed/${preferred.key}`
        };
    }

    /**
     * Map TMDB provider ID to our internal service ID
     */
    private mapProviderId(tmdbId: number): string | null {
        const mapping: Record<number, string> = {
            8: 'netflix',
            9: 'prime',
            119: 'prime',
            337: 'jiohotstar',
            122: 'jiohotstar',
            232: 'zee5',
            237: 'sonyliv',
            384: 'hbo',
            15: 'hulu',
            350: 'apple',
            531: 'paramount'
        };
        return mapping[tmdbId] || null;
    }

    /**
     * Get our internal provider IDs as TMDB provider IDs
     * Note: TMDB ID 337 is "JioHotstar" in India market (formerly Disney+ Hotstar)
     */
    getProviderTmdbIds(serviceIds: string[]): number[] {
        const mapping: Record<string, number[]> = {
            'netflix': [8],
            'prime': [9, 119],
            'jiohotstar': [337, 122],
            'zee5': [232],
            'sonyliv': [237],
            'hbo': [384],
            'hulu': [15],
            'apple': [350],
            'paramount': [531]
        };

        const ids = serviceIds.flatMap((id) => mapping[id] ?? []);
        return Array.from(new Set(ids));
    }

    private expandProviderIds(providerId: number): number[] {
        return this.providerAliasMap[providerId] || [providerId];
    }
}

// Export singleton instance
export const tmdbService = new TMDBService();
