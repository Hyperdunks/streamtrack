import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

export interface ContentItem {
  id: number | string;
  tmdbId?: number;
  title?: string;
  name?: string; // TV shows often use 'name' instead of 'title'
  type: 'movie' | 'tv';
  poster_path: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: string[];
  runtime?: number;
  vote_average: number;
  vote_count?: number;
  overview?: string;
  watchProviders?: string[];
  status?: string;
  tagline?: string;
  director?: string;
  creators?: string[];
  writers?: string[];
  cast?: string[];
  crew?: string[];
  castMembers?: CastMember[];
  trailer?: TrailerInfo | null;
  similar?: PagedContentResponse;
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

export interface PagedContentResponse {
  results: ContentItem[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export interface DiscoverVibe {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  genres: number[];
  minRating?: number;
  isCustom?: boolean;
}

export interface DiscoverVibesResponse {
  vibes: DiscoverVibe[];
  customVibes: DiscoverVibe[];
}

export interface DiscoverGenre {
  id: number;
  name: string;
}

export type TonightSlot = 'morning' | 'evening' | 'night';

export interface TonightPickResponse {
  pick: ContentItem | null;
  options?: ContentItem[];
  reason: string;
  slot?: TonightSlot;
  vibeId?: string;
  vibeName?: string;
  prioritizedBySubscriptions?: boolean;
  suggestion?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ContentService {
  private api = inject(ApiService);
  private contentPath = '/content';
  private discoverPath = '/discover';

  private buildProviderQuery(
    page: number,
    providerId?: number | null,
    watchRegion = 'IN',
    extraParams: Record<string, string> = {},
  ): string {
    const params = new URLSearchParams({
      page: String(page),
      watch_region: watchRegion,
      ...extraParams,
    });

    if (providerId !== null && providerId !== undefined) {
      params.set('providerId', String(providerId));
    }

    return params.toString();
  }

  getTrending(
    type: 'movie' | 'tv' | 'all' = 'all',
    time: 'day' | 'week' = 'week',
  ): Observable<ContentItem[]> {
    return this.getTrendingPage(type, time, 1).pipe(map((res) => res.results));
  }

  getTrendingPage(
    type: 'movie' | 'tv' | 'all' = 'all',
    time: 'day' | 'week' = 'week',
    page = 1,
    providerId?: number | null,
    watchRegion = 'IN',
  ): Observable<PagedContentResponse> {
    const params = new URLSearchParams({
      type,
      time,
      page: String(page),
      watch_region: watchRegion,
    });

    if (providerId !== null && providerId !== undefined) {
      params.set('providerId', String(providerId));
    }

    return this.api
      .get<PagedContentResponse>(`${this.contentPath}/trending?${params.toString()}`)
      .pipe(
        map((res) => ({
          ...res,
          results: res.results.map((item) => ({
            ...item,
            type: item.type || (type === 'all' ? 'movie' : type),
          })),
        })),
      );
  }

  search(
    query: string,
    page = 1,
    type: 'movie' | 'tv' | 'all' = 'all',
  ): Observable<PagedContentResponse> {
    const encoded = encodeURIComponent(query.trim());
    return this.api
      .get<PagedContentResponse>(
        `${this.contentPath}/search?query=${encoded}&page=${page}&type=${type}`,
      )
      .pipe(
        map((res) => ({
          ...res,
          results: res.results.map((item) => ({
            ...item,
            type: item.type || (type === 'all' ? 'movie' : type),
          })),
        })),
      );
  }

  getMoviesPage(
    page = 1,
    providerId?: number | null,
    watchRegion = 'IN',
  ): Observable<PagedContentResponse> {
    const query = this.buildProviderQuery(page, providerId, watchRegion);

    return this.api.get<PagedContentResponse>(`${this.contentPath}/movies?${query}`).pipe(
      map((res) => ({
        ...res,
        results: res.results.map((item) => ({
          ...item,
          type: 'movie' as const,
        })),
      })),
    );
  }

  getTvShowsPage(
    page = 1,
    providerId?: number | null,
    watchRegion = 'IN',
  ): Observable<PagedContentResponse> {
    const query = this.buildProviderQuery(page, providerId, watchRegion);

    return this.api.get<PagedContentResponse>(`${this.contentPath}/tv-shows?${query}`).pipe(
      map((res) => ({
        ...res,
        results: res.results.map((item) => ({
          ...item,
          type: 'tv' as const,
        })),
      })),
    );
  }

  getUpcomingPage(
    type: 'movie' | 'tv',
    page = 1,
    providerId?: number | null,
    watchRegion = 'IN',
  ): Observable<PagedContentResponse> {
    const query = this.buildProviderQuery(page, providerId, watchRegion, { type });

    return this.api.get<PagedContentResponse>(`${this.contentPath}/upcoming?${query}`).pipe(
      map((res) => ({
        ...res,
        results: res.results.map((item) => ({
          ...item,
          type: item.type || type,
        })),
      })),
    );
  }

  getUpcomingMoviesPage(
    page = 1,
    providerId?: number | null,
    watchRegion = 'IN',
  ): Observable<PagedContentResponse> {
    return this.getUpcomingPage('movie', page, providerId, watchRegion);
  }

  getUpcomingTvShowsPage(
    page = 1,
    providerId?: number | null,
    watchRegion = 'IN',
  ): Observable<PagedContentResponse> {
    return this.getUpcomingPage('tv', page, providerId, watchRegion);
  }

  getCatalogPage(
    type: 'movie' | 'tv',
    page = 1,
    providerId?: number | null,
    watchRegion = 'IN',
  ): Observable<PagedContentResponse> {
    if (type === 'movie') {
      return this.getMoviesPage(page, providerId, watchRegion);
    }

    if (type === 'tv') {
      return this.getTvShowsPage(page, providerId, watchRegion);
    }

    const query = this.buildProviderQuery(page, providerId, watchRegion, { type });

    return this.api
      .get<PagedContentResponse>(`${this.contentPath}/catalog?${query}`)
      .pipe(
        map((res) => ({
          ...res,
          results: res.results.map((item) => ({
            ...item,
            type,
          })),
        })),
      );
  }

  getAnime(page = 1): Observable<ContentItem[]> {
    return this.getAnimePage(page).pipe(map((res) => res.results));
  }

  getAnimePage(page = 1): Observable<PagedContentResponse> {
    return this.api.get<PagedContentResponse>(`${this.contentPath}/anime?page=${page}`).pipe(
      map((res) => ({
        ...res,
        results: res.results.map((item) => ({
          ...item,
          type: item.type || 'tv',
        })),
      })),
    );
  }

  getDetails(type: 'movie' | 'tv', id: number): Observable<ContentItem> {
    return this.api.get<{ content: ContentItem }>(`${this.contentPath}/${type}/${id}`).pipe(
      map((res) => ({
        ...res.content,
        type: res.content.type || type,
        castMembers: (res.content as any).castMembers || (res.content as any).cast || [],
      })),
    );
  }

  getMovieDetails(id: number): Observable<ContentItem> {
    return this.api.get<{ content: ContentItem }>(`${this.contentPath}/movie/${id}`).pipe(
      map((res) => ({
        ...res.content,
        type: 'movie',
        castMembers: (res.content as any).castMembers || (res.content as any).cast || [],
      })),
    );
  }

  getTvDetails(id: number): Observable<ContentItem> {
    return this.api.get<{ content: ContentItem }>(`${this.contentPath}/tv/${id}`).pipe(
      map((res) => ({
        ...res.content,
        type: 'tv',
        castMembers: (res.content as any).castMembers || (res.content as any).cast || [],
      })),
    );
  }

  getSimilar(type: 'movie' | 'tv', id: number, page = 1): Observable<PagedContentResponse> {
    return this.api
      .get<PagedContentResponse>(`${this.contentPath}/${type}/${id}/similar?page=${page}`)
      .pipe(
        map((res) => ({
          ...res,
          results: res.results.map((item) => ({
            ...item,
            type: item.type || type,
          })),
        })),
      );
  }

  getVibes(): Observable<DiscoverVibesResponse> {
    return this.api.get<DiscoverVibesResponse>(`${this.discoverPath}/vibes`);
  }

  getDiscoverGenres(): Observable<DiscoverGenre[]> {
    return this.api
      .get<{ genres: DiscoverGenre[] }>(`${this.discoverPath}/genres`)
      .pipe(map((res) => res.genres || []));
  }

  discoverByVibePage(
    vibeId: string,
    type: 'movie' | 'tv',
    page = 1,
    providerId?: number | null,
    watchRegion = 'IN',
  ): Observable<PagedContentResponse> {
    const params = new URLSearchParams({
      vibe: vibeId,
      type,
      page: String(page),
      watch_region: watchRegion,
    });

    if (providerId !== null && providerId !== undefined) {
      params.set('providerId', String(providerId));
    }

    return this.api
      .get<{
        results: ContentItem[];
        page?: number;
        totalPages?: number;
        totalResults?: number;
      }>(`${this.discoverPath}?${params.toString()}`)
      .pipe(
        map((res) => ({
          results: (res.results || []).map((item) => ({
            ...item,
            type: item.type || type,
          })),
          page: res.page || page,
          totalPages: res.totalPages || 1,
          totalResults: res.totalResults || res.results?.length || 0,
        })),
      );
  }

  getTonightPick(localHour = new Date().getHours()): Observable<TonightPickResponse> {
    return this.api.get<TonightPickResponse>(`${this.discoverPath}/tonight?localHour=${localHour}`);
  }

  getPopular(type: 'movie' | 'tv'): Observable<ContentItem[]> {
    // Reusing trending for variety or search as needed
    return this.getTrending(type, 'week');
  }
}
