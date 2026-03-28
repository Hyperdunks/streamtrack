import { Injectable, effect, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface WatchlistItem {
  contentId: string;
  title: string;
  type: 'movie' | 'tv';
  posterPath?: string;
  backdropPath?: string;
  status: 'want' | 'watching' | 'watched';
  rating?: number;
  notes?: string;
  addedAt?: string | Date;
  updatedAt?: string | Date;
  year?: string;
  director?: string;
  runtime?: string;
  genre?: string;
  description?: string;
  cast?: string[];
  whereToWatch?: string[];
  platforms?: string[];
  reviews?: { author: string; text: string }[];
  vibes?: string[];
}

export interface WatchlistStats {
  total: number;
  want: number;
  watching: number;
  watched: number;
  byType: {
    movie: number;
    tv: number;
  };
}

interface RawWatchlistStats {
  total?: number;
  want?: number;
  watching?: number;
  watched?: number;
  byStatus?: {
    want?: number;
    watching?: number;
    watched?: number;
  };
  byType?: {
    movie?: number;
    tv?: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class WatchlistService {
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private endpoint = '/watchlist';
  private imageBaseUrl = 'https://image.tmdb.org/t/p/';
  private storageKeyPrefix = 'stream-watchlist';
  private activeStorageKey = this.buildStorageKey();
  private itemsSubject = new BehaviorSubject<WatchlistItem[]>(this.loadFromStorage(this.activeStorageKey));
  private hasTriedServerSync = false;

  constructor() {
    effect(() => {
      const storageKey = this.buildStorageKey();
      const isInitialized = this.authService.isInitialized();
      const hasActiveSession = this.authService.hasActiveSession();

      if (storageKey !== this.activeStorageKey) {
        this.activeStorageKey = storageKey;
        this.hasTriedServerSync = false;
        this.itemsSubject.next(this.loadFromStorage(this.activeStorageKey));
      }

      if (!isInitialized) {
        return;
      }

      if (hasActiveSession) {
        this.syncFromServer(true);
        return;
      }

      this.hasTriedServerSync = false;
    });
  }

  private buildStorageKey(): string {
    return `${this.storageKeyPrefix}:${this.authService.watchlistStorageKey()}`;
  }

  private loadFromStorage(storageKey: string): WatchlistItem[] {
    if (typeof window === 'undefined') return [];

    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return this.sortByAddedAt(parsed.filter(this.isValidWatchlistItem));
    } catch {
      return [];
    }
  }

  private saveToStorage(items: WatchlistItem[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.activeStorageKey, JSON.stringify(items));
  }

  private isValidWatchlistItem = (value: unknown): value is WatchlistItem => {
    if (!value || typeof value !== 'object') return false;
    const item = value as Partial<WatchlistItem>;
    return (
      typeof item.contentId === 'string' &&
      typeof item.title === 'string' &&
      (item.type === 'movie' || item.type === 'tv')
    );
  };

  private sortByAddedAt(items: WatchlistItem[]): WatchlistItem[] {
    return [...items].sort((a, b) => {
      const aTime = new Date(a.addedAt || 0).getTime();
      const bTime = new Date(b.addedAt || 0).getTime();
      return bTime - aTime;
    });
  }

  private setItems(items: WatchlistItem[]): void {
    const sorted = this.sortByAddedAt(items);
    this.itemsSubject.next(sorted);
    this.saveToStorage(sorted);
  }

  private upsertItem(item: WatchlistItem): void {
    const current = this.itemsSubject.value;
    const index = current.findIndex((i) => i.contentId === item.contentId);
    if (index === -1) {
      this.setItems([{ ...item }, ...current]);
      return;
    }

    const next = [...current];
    next[index] = { ...next[index], ...item };
    this.setItems(next);
  }

  private removeItem(contentId: string): void {
    this.setItems(this.itemsSubject.value.filter((item) => item.contentId !== contentId));
  }

  private shouldFallbackToLocal(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : '';
    // ApiService throws Error with status inside
    return msg.includes('Error: 0') || msg.includes('Error: 401') || msg.includes('Error: 403');
  }

  private normalizeIncomingItem(item: Partial<WatchlistItem>): WatchlistItem {
    const now = new Date().toISOString();

    return {
      contentId: item.contentId || `local-${Date.now()}`,
      title: item.title || 'Untitled',
      type: item.type === 'tv' ? 'tv' : 'movie',
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      status: item.status || 'want',
      rating: item.rating,
      notes: item.notes,
      addedAt: item.addedAt || now,
      updatedAt: item.updatedAt || now,
      year: item.year,
      director: item.director,
      runtime: item.runtime,
      genre: item.genre,
      description: item.description,
      cast: item.cast,
      whereToWatch: item.whereToWatch,
      platforms: item.platforms,
      reviews: item.reviews,
      vibes: item.vibes,
    };
  }

  private syncFromServer(force = false): void {
    if (!this.authService.isInitialized() || !this.authService.hasActiveSession()) {
      return;
    }

    if (this.hasTriedServerSync && !force) return;
    this.hasTriedServerSync = true;

    this.api
      .get<{ watchlist: WatchlistItem[] }>(this.endpoint)
      .pipe(
        map((response) => response.watchlist.map((item) => this.normalizeIncomingItem(item))),
        catchError((error) => {
          if (this.shouldFallbackToLocal(error)) {
            this.hasTriedServerSync = false;
            return of(this.itemsSubject.value);
          }

          this.hasTriedServerSync = false;
          return throwError(() => error);
        }),
      )
      .subscribe({
        next: (items) => this.setItems(items),
        error: (error) => console.error('Error syncing watchlist from API:', error),
      });
  }

  private buildStats(items: WatchlistItem[]): WatchlistStats {
    return {
      total: items.length,
      want: items.filter((item) => item.status === 'want').length,
      watching: items.filter((item) => item.status === 'watching').length,
      watched: items.filter((item) => item.status === 'watched').length,
      byType: {
        movie: items.filter((item) => item.type === 'movie').length,
        tv: items.filter((item) => item.type === 'tv').length,
      },
    };
  }

  private normalizeStats(stats: RawWatchlistStats | null | undefined): WatchlistStats {
    return {
      total: Number(stats?.total || 0),
      want: Number(stats?.want ?? stats?.byStatus?.want ?? 0),
      watching: Number(stats?.watching ?? stats?.byStatus?.watching ?? 0),
      watched: Number(stats?.watched ?? stats?.byStatus?.watched ?? 0),
      byType: {
        movie: Number(stats?.byType?.movie ?? 0),
        tv: Number(stats?.byType?.tv ?? 0),
      },
    };
  }

  getImageUrl(path: string | undefined, size: 'w500' | 'original' = 'w500'): string {
    if (!path) return 'https://placehold.co/600x900/1a1a1a/ffffff?text=StreamTrack';
    if (path.startsWith('http')) return path;
    return `${this.imageBaseUrl}${size}${path}`;
  }

  getBackdropUrl(path: string | undefined): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${this.imageBaseUrl}original${path}`;
  }

  getWatchlist(status?: string): Observable<WatchlistItem[]> {
    this.syncFromServer();

    return this.itemsSubject
      .asObservable()
      .pipe(map((items) => (status ? items.filter((item) => item.status === status) : items)));
  }

  addWatchlistItem(item: Partial<WatchlistItem>): Observable<WatchlistItem> {
    const normalized = this.normalizeIncomingItem(item);
    const exists = this.itemsSubject.value.some(
      (existing) => existing.contentId === normalized.contentId,
    );

    if (exists) {
      return throwError(() => new Error('Item already in watchlist'));
    }

    return this.api.post<{ message: string; item: WatchlistItem }>(this.endpoint, item).pipe(
      map((response) => this.normalizeIncomingItem(response.item)),
      tap((added) => this.upsertItem(added)),
      catchError((error) => {
        if (!this.shouldFallbackToLocal(error)) {
          return throwError(() => error);
        }

        this.upsertItem(normalized);
        return of(normalized);
      }),
    );
  }

  updateWatchlistItem(
    contentId: string,
    updates: Partial<WatchlistItem>,
  ): Observable<WatchlistItem> {
    return this.api
      .put<{ message: string; item: WatchlistItem }>(`${this.endpoint}/${contentId}`, updates)
      .pipe(
        map((response) => this.normalizeIncomingItem(response.item)),
        tap((updated) => this.upsertItem(updated)),
        catchError((error) => {
          if (!this.shouldFallbackToLocal(error)) {
            return throwError(() => error);
          }

          const existing = this.itemsSubject.value.find((item) => item.contentId === contentId);
          if (!existing) {
            return throwError(() => new Error('Item not in watchlist'));
          }

          const updated = this.normalizeIncomingItem({
            ...existing,
            ...updates,
            contentId,
            updatedAt: new Date().toISOString(),
          });

          this.upsertItem(updated);
          return of(updated);
        }),
      );
  }

  removeWatchlistItem(contentId: string): Observable<void> {
    return this.api.delete<void>(`${this.endpoint}/${contentId}`).pipe(
      tap(() => this.removeItem(contentId)),
      catchError((error) => {
        if (!this.shouldFallbackToLocal(error)) {
          return throwError(() => error);
        }

        this.removeItem(contentId);
        return of(void 0);
      }),
    );
  }

  getStats(): Observable<WatchlistStats> {
    const localStats = this.buildStats(this.itemsSubject.value);

    return this.api.get<{ stats: RawWatchlistStats }>(`${this.endpoint}/stats`).pipe(
      map((response) => this.normalizeStats(response.stats)),
      catchError((error) => {
        if (!this.shouldFallbackToLocal(error)) {
          return throwError(() => error);
        }

        return of(localStats);
      }),
    );
  }
}
