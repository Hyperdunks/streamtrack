// Shared TypeScript types
export interface User {
    firebaseUid: string;
    email: string;
    name: string;
    services: string[];
    region: string;
    watchlist: WatchlistItem[];
    createdAt: Date;
    updatedAt: Date;
}

export interface WatchlistItem {
    contentId: string;
    title: string;
    type: 'movie' | 'tv';
    posterPath: string;
    genre?: string;
    status: 'want' | 'watching' | 'watched';
    rating?: number;
    notes?: string;
    addedAt: Date;
    updatedAt: Date;
}

export interface StreamingService {
    id: string;
    name: string;
    providerId: number; // TMDB provider ID
    logoUrl: string;
}

export const SUPPORTED_SERVICES: StreamingService[] = [
    { id: 'netflix', name: 'Netflix', providerId: 8, logoUrl: '/assets/services/netflix.svg' },
    { id: 'prime', name: 'Amazon Prime Video', providerId: 9, logoUrl: '/assets/services/prime.svg' },
    { id: 'jiohotstar', name: 'JioHotstar', providerId: 337, logoUrl: '/assets/services/jiohotstar.svg' },
    { id: 'hbo', name: 'HBO Max', providerId: 384, logoUrl: '/assets/services/hbo.svg' },
    { id: 'hulu', name: 'Hulu', providerId: 15, logoUrl: '/assets/services/hulu.svg' },
    { id: 'apple', name: 'Apple TV+', providerId: 350, logoUrl: '/assets/services/apple.svg' },
    { id: 'paramount', name: 'Paramount+', providerId: 531, logoUrl: '/assets/services/paramount.svg' },
];
