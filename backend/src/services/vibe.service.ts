/**
 * Vibe Service - Maps vibes to genre combinations and TMDB discover parameters
 */

import { tmdbService, ContentItem } from './tmdb.service';

// TMDB Genre IDs
export const GENRE_IDS = {
    ACTION: 28,
    ANIMATION: 16,
    COMEDY: 35,
    CRIME: 80,
    DOCUMENTARY: 99,
    DRAMA: 18,
    HORROR: 27,
    MYSTERY: 9648,
    ROMANCE: 10749,
    THRILLER: 53,
    FAMILY: 10751,
    FANTASY: 14,
    SCIFI: 878,
    WAR: 10752
} as const;

// Vibe definition
export interface VibeDefinition {
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    genres: number[];
    excludeGenres?: number[];
    minRating?: number;
    maxRuntime?: number;
}

// Vibe configurations
export const VIBE_MAP: Record<string, VibeDefinition> = {
    cozy: {
        id: 'cozy',
        name: 'Cozy',
        icon: 'coffee',
        color: '#f472b6',
        description: 'Warm and comforting content for relaxing',
        genres: [GENRE_IDS.ROMANCE, GENRE_IDS.COMEDY, GENRE_IDS.ANIMATION, GENRE_IDS.FAMILY],
        excludeGenres: [GENRE_IDS.HORROR, GENRE_IDS.THRILLER, GENRE_IDS.CRIME],
        minRating: 7.0
    },
    intense: {
        id: 'intense',
        name: 'Intense',
        icon: 'zap',
        color: '#ef4444',
        description: 'Edge-of-your-seat thrills and action',
        genres: [GENRE_IDS.THRILLER, GENRE_IDS.ACTION, GENRE_IDS.CRIME],
        minRating: 7.5
    },
    mindless: {
        id: 'mindless',
        name: 'Mindless',
        icon: 'gamepad-2',
        color: '#fbbf24',
        description: 'Easy watching, no brainpower required',
        genres: [GENRE_IDS.COMEDY, GENRE_IDS.ANIMATION],
        minRating: 6.0,
        maxRuntime: 100
    },
    thoughtful: {
        id: 'thoughtful',
        name: 'Thoughtful',
        icon: 'lightbulb',
        color: '#3b82f6',
        description: 'Stimulating content that makes you think',
        genres: [GENRE_IDS.DOCUMENTARY, GENRE_IDS.DRAMA, GENRE_IDS.MYSTERY],
        minRating: 7.5
    },
    dark: {
        id: 'dark',
        name: 'Dark',
        icon: 'moon',
        color: '#8b5cf6',
        description: 'Moody, mysterious, and atmospheric',
        genres: [GENRE_IDS.HORROR, GENRE_IDS.THRILLER, GENRE_IDS.MYSTERY],
        minRating: 6.5
    },
    funny: {
        id: 'funny',
        name: 'Funny',
        icon: 'smile',
        color: '#f97316',
        description: 'Guaranteed laughs and good times',
        genres: [GENRE_IDS.COMEDY],
        minRating: 7.0
    }
};

type TimeSlot = 'morning' | 'evening' | 'night';

interface TonightPickOptions {
    localHour?: number;
}

interface TonightPickResult {
    pick: ContentItem | null;
    options: ContentItem[];
    reason: string;
    slot: TimeSlot;
    vibeId: string;
    vibeName: string;
    prioritizedBySubscriptions: boolean;
}

const SLOT_PRIMARY_VIBE: Record<TimeSlot, string> = {
    morning: 'cozy',
    evening: 'intense',
    night: 'dark'
};

const SLOT_FALLBACK_VIBES: Record<TimeSlot, string[]> = {
    morning: ['funny', 'mindless'],
    evening: ['thoughtful', 'funny'],
    night: ['mindless', 'thoughtful']
};

class VibeService {
    /**
     * Get all available vibes
     */
    getVibes(): VibeDefinition[] {
        return Object.values(VIBE_MAP);
    }

    /**
     * Get a specific vibe by ID
     */
    getVibe(vibeId: string): VibeDefinition | undefined {
        return VIBE_MAP[vibeId];
    }

    /**
     * Discover content by vibe, filtered by user's services
     */
    async discoverByVibe(
        vibeId: string,
        userServices: string[],
        type: 'movie' | 'tv' = 'movie',
        page = 1,
        providerId?: number,
        watchRegion = 'IN'
    ): Promise<{ results: ContentItem[]; vibe: VibeDefinition | undefined }> {
        const vibe = VIBE_MAP[vibeId];

        if (!vibe) {
            return { results: [], vibe: undefined };
        }

        // Convert user services to TMDB provider IDs
        const providerIds = tmdbService.getProviderTmdbIds(userServices);
        const forcedProviderIds = typeof providerId === 'number' ? [providerId] : undefined;

        // Discover content with vibe filters
        const results = await tmdbService.discover(type, {
            genres: vibe.genres,
            genreMode: 'or',
            providers: forcedProviderIds || (providerIds.length > 0 ? providerIds : undefined),
            minRating: vibe.minRating,
            watchRegion,
            page,
            sortBy: 'popularity.desc'
        });

        // Filter out excluded genres if any
        let filteredResults = results;
        if (vibe.excludeGenres && vibe.excludeGenres.length > 0) {
            filteredResults = results.filter(item =>
                !item.genre_ids?.some(g => vibe.excludeGenres!.includes(g))
            );
        }

        // Filter by runtime if specified
        if (vibe.maxRuntime && type === 'movie') {
            // Note: Runtime filtering would need content details - for now skip
            // This could be enhanced with parallel detail fetches
        }

        return { results: filteredResults, vibe };
    }

    /**
     * Discover content by custom vibe (user-defined)
     */
    async discoverByCustomVibe(
        customVibe: { id: string; name: string; genres: number[]; minRating?: number; color?: string },
        userServices: string[],
        type: 'movie' | 'tv' = 'movie',
        page = 1,
        providerId?: number,
        watchRegion = 'IN'
    ): Promise<{ results: ContentItem[]; vibe: VibeDefinition }> {
        // Convert custom vibe to VibeDefinition format
        const vibeDefinition: VibeDefinition = {
            id: `custom-${customVibe.id}`,
            name: customVibe.name,
            icon: 'sparkles',
            color: customVibe.color || '#6366f1', // Default indigo
            description: `Custom vibe: ${customVibe.name}`,
            genres: customVibe.genres,
            minRating: customVibe.minRating
        };

        // Convert user services to TMDB provider IDs
        const providerIds = tmdbService.getProviderTmdbIds(userServices);
        const forcedProviderIds = typeof providerId === 'number' ? [providerId] : undefined;

        // Discover content with custom vibe filters
        const results = await tmdbService.discover(type, {
            genres: customVibe.genres,
            genreMode: 'or',
            providers: forcedProviderIds || (providerIds.length > 0 ? providerIds : undefined),
            minRating: customVibe.minRating,
            watchRegion,
            page,
            sortBy: 'popularity.desc'
        });

        return { results, vibe: vibeDefinition };
    }

    /**
     * Get "Tonight's Pick" - personalized recommendation
     */
    async getTonightsPick(
        userServices: string[],
        watchlistTmdbIds: number[] = [],
        options: TonightPickOptions = {}
    ): Promise<TonightPickResult> {
        const localHour = this.normalizeHour(options.localHour);
        const slot = this.resolveTimeSlot(localHour);
        const primaryVibeId = SLOT_PRIMARY_VIBE[slot];
        const vibeCandidates = [primaryVibeId, ...SLOT_FALLBACK_VIBES[slot]];
        const prioritizedBySubscriptions = userServices.length > 0;

        for (const candidateVibeId of vibeCandidates) {
            const candidates = await this.getTopRatedCandidatesByVibe(candidateVibeId, userServices);
            const unwatched = candidates.filter(item => !watchlistTmdbIds.includes(item.tmdbId));
            const shortlist = unwatched.length > 0 ? unwatched : candidates;

            if (shortlist.length === 0) {
                continue;
            }

            const selectedVibe = VIBE_MAP[candidateVibeId] || VIBE_MAP[primaryVibeId];
            const usedFallbackVibe = candidateVibeId !== primaryVibeId;

            return {
                pick: shortlist[0],
                options: shortlist.slice(0, 8),
                reason: this.buildTonightReason(slot, selectedVibe.name, prioritizedBySubscriptions, usedFallbackVibe),
                slot,
                vibeId: selectedVibe.id,
                vibeName: selectedVibe.name,
                prioritizedBySubscriptions
            };
        }

        const primaryVibe = VIBE_MAP[primaryVibeId];
        return {
            pick: null,
            options: [],
            reason: this.buildTonightReason(slot, primaryVibe.name, prioritizedBySubscriptions, false),
            slot,
            vibeId: primaryVibe.id,
            vibeName: primaryVibe.name,
            prioritizedBySubscriptions
        };
    }

    private normalizeHour(localHour?: number): number {
        if (typeof localHour !== 'number' || !Number.isFinite(localHour)) {
            return new Date().getHours();
        }

        const roundedHour = Math.floor(localHour);
        if (roundedHour < 0) {
            return 0;
        }

        if (roundedHour > 23) {
            return 23;
        }

        return roundedHour;
    }

    private resolveTimeSlot(hour: number): TimeSlot {
        if (hour >= 5 && hour < 12) {
            return 'morning';
        }

        if (hour >= 17 && hour < 22) {
            return 'evening';
        }

        return 'night';
    }

    private async getTopRatedCandidatesByVibe(
        vibeId: string,
        userServices: string[]
    ): Promise<ContentItem[]> {
        const [movieResults, tvResults] = await Promise.all([
            this.discoverByVibe(vibeId, userServices, 'movie', 1),
            this.discoverByVibe(vibeId, userServices, 'tv', 1)
        ]);

        const deduped = new Map<string, ContentItem>();
        [...movieResults.results, ...tvResults.results].forEach((item) => {
            const key = `${item.type}-${item.tmdbId}`;
            if (!deduped.has(key)) {
                deduped.set(key, item);
            }
        });

        return Array.from(deduped.values()).sort((a, b) => {
            if (b.vote_average !== a.vote_average) {
                return b.vote_average - a.vote_average;
            }

            return (b.vote_count || 0) - (a.vote_count || 0);
        });
    }

    private buildTonightReason(
        slot: TimeSlot,
        vibeName: string,
        prioritizedBySubscriptions: boolean,
        usedFallbackVibe: boolean
    ): string {
        const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
        const fallbackNote = usedFallbackVibe ? ' using a close fallback vibe.' : '.';

        if (prioritizedBySubscriptions) {
            return `${slotLabel} pick: ${vibeName} mood, prioritized by top-rated titles on your subscriptions${fallbackNote}`;
        }

        return `${slotLabel} pick: ${vibeName} mood, prioritized by top-rated titles right now${fallbackNote}`;
    }
    /**
     * Get recommendations based on genres (for onboarding)
     */
    async getOnboardingRecommendations(
        genres: number[],
        userServices: string[],
        page = 1
    ): Promise<ContentItem[]> {
        // Convert user services to TMDB provider IDs
        const providerIds = tmdbService.getProviderTmdbIds(userServices);

        // Discover content
        const results = await tmdbService.discover('movie', {
            genres,
            providers: providerIds.length > 0 ? providerIds : undefined,
            minRating: 7.0, // Good quality baseline
            page,
            sortBy: 'popularity.desc'
        });

        return results;
    }
}

export const vibeService = new VibeService();
