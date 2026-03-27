import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription, combineLatest, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ContentItem,
  ContentService,
  PagedContentResponse,
} from '../services/content.service';
import { WatchlistService } from '../services/watchlist.service';
import { AuthService } from '../services/auth.service';
import { ShowCardComponent } from './show-card.component';

interface ProviderUi {
  id: string;
  label: string;
  colorClass: string;
}

const PROVIDER_UI: Record<string, ProviderUi> = {
  netflix: { id: 'netflix', label: 'Netflix', colorClass: 'bg-black/[0.04] text-black/80 border border-black/10' },
  prime: { id: 'prime', label: 'Prime Video', colorClass: 'bg-black/[0.04] text-black/80 border border-black/10' },
  jiohotstar: {
    id: 'jiohotstar',
    label: 'JioHotstar',
    colorClass: 'bg-black/[0.04] text-black/80 border border-black/10',
  },
  hbo: { id: 'hbo', label: 'Max', colorClass: 'bg-black/[0.04] text-black/80 border border-black/10' },
  hulu: { id: 'hulu', label: 'Hulu', colorClass: 'bg-black/[0.04] text-black/80 border border-black/10' },
  apple: { id: 'apple', label: 'Apple TV+', colorClass: 'bg-black/[0.04] text-black/80 border border-black/10' },
  paramount: {
    id: 'paramount',
    label: 'Paramount+',
    colorClass: 'bg-black/[0.04] text-black/80 border border-black/10',
  },
  zee5: { id: 'zee5', label: 'ZEE5', colorClass: 'bg-black/[0.04] text-black/80 border border-black/10' },
  sonyliv: { id: 'sonyliv', label: 'SonyLIV', colorClass: 'bg-black/[0.04] text-black/80 border border-black/10' },
};

@Component({
  selector: 'app-content-details-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, ShowCardComponent],
  template: `
    <div class="min-h-screen bg-[var(--surface-app)] text-black">
      @if (isLoading() && !content()) {
        <div class="flex min-h-screen items-center justify-center">
          <div class="flex flex-col items-center gap-4">
            <div class="h-9 w-9 animate-spin rounded-full border-4 border-black/20 border-t-black"></div>
            <span class="text-[11px] font-mono uppercase tracking-widest text-black/55">Loading Details</span>
          </div>
        </div>
      } @else if (errorMessage()) {
        <div class="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <h1 class="text-2xl font-semibold tracking-tight">Details unavailable</h1>
          <p class="mt-3 text-sm text-black/65">{{ errorMessage() }}</p>
          <button
            (click)="goBack()"
            class="st-pill mt-8 border border-black/15 text-[11px] font-mono uppercase tracking-widest text-black/80 transition-colors hover:bg-black/5 cursor-pointer"
          >
            Go Back
          </button>
        </div>
      } @else if (content(); as detail) {
        <section class="relative overflow-hidden border-b border-black/10">
          <img
            [src]="heroBackdrop()"
            [alt]="detail.title || detail.name"
            class="absolute inset-0 h-full w-full object-cover"
          />
          <div class="absolute inset-0 bg-gradient-to-b from-white/70 via-white/80 to-[var(--surface-app)]"></div>
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.55),transparent_45%)]"></div>

          <div class="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
            <button
              (click)="goBack()"
              class="st-pill mb-8 inline-flex items-center gap-2 border border-black/15 text-[11px] font-mono uppercase tracking-widest text-black/85 transition-colors hover:bg-black/5 cursor-pointer"
            >
              <lucide-icon name="arrow-left" class="h-4 w-4"></lucide-icon>
              Back
            </button>

            <div class="grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
              <div>
                <img
                  [src]="watchlistService.getImageUrl(detail.poster_path, 'original')"
                  [alt]="detail.title || detail.name"
                  loading="eager"
                  fetchpriority="high"
                  class="st-card aspect-[2/3] w-full border border-black/10 object-cover shadow-xl"
                />
              </div>

              <div class="self-end pb-2">
                <div class="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-black/65">
                  <span class="st-pill border border-black/15 bg-white text-black">{{ detail.type }}</span>
                  @if (releaseYear()) {
                    <span class="st-pill border border-black/15 bg-white">{{ releaseYear() }}</span>
                  }
                  @if (detail.runtime) {
                    <span class="st-pill border border-black/15 bg-white">{{ detail.runtime }} min</span>
                  }
                </div>

                <h1 class="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  {{ detail.title || detail.name }}
                </h1>

                <div class="mt-4 flex items-center gap-2">
                  <span
                    class="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-black font-mono"
                  >
                    <lucide-icon name="star" class="h-3 w-3 fill-black"></lucide-icon>
                    {{ (detail.vote_average || 0).toFixed(1) }}
                  </span>
                </div>

                <p class="mt-6 max-w-3xl text-base leading-relaxed text-black/80">
                  {{ detail.overview || 'No overview available.' }}
                </p>

                <div class="mt-6 flex flex-wrap gap-2">
                  @for (provider of providers(); track provider.id) {
                    <span class="rounded-lg px-3 py-1.5 text-xs font-medium" [ngClass]="provider.colorClass">
                      {{ provider.label }}
                    </span>
                  }
                </div>

                <div class="mt-8 flex flex-wrap items-center gap-3">
                  @if (watchlistStatus()) {
                    @if (watchlistStatus() !== 'watched') {
                      <button
                        (click)="updateWatchlistStatus('watched')"
                        class="st-pill inline-flex items-center gap-2 bg-black text-white text-xs font-mono uppercase tracking-widest transition-all duration-200 hover:bg-black/80"
                      >
                        <lucide-icon name="check" class="h-4 w-4"></lucide-icon>
                        Mark Watched
                      </button>
                    } @else {
                      <span
                        class="st-pill inline-flex items-center gap-2 bg-black text-white text-xs font-mono uppercase tracking-widest"
                      >
                        <lucide-icon name="check" class="h-4 w-4"></lucide-icon>
                        Watched
                      </span>
                    }
                    <button
                      (click)="updateWatchlistStatus(watchlistStatus() === 'watching' ? 'want' : 'watching')"
                      class="st-pill inline-flex items-center gap-2 border border-black/15 bg-white text-xs font-mono uppercase tracking-widest text-black/85 transition-colors hover:bg-black/5"
                    >
                      <lucide-icon [name]="watchlistStatus() === 'watching' ? 'bookmark' : 'play'" class="h-4 w-4"></lucide-icon>
                      {{ watchlistStatus() === 'watching' ? 'Move to Wishlist' : 'Start Watching' }}
                    </button>

                    <button
                      (click)="removeFromWatchlist()"
                      [disabled]="isRemovingFromWatchlist()"
                      class="st-pill inline-flex items-center gap-2 border border-black/15 bg-white text-xs font-mono uppercase tracking-widest text-black/85 transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-black/5"
                    >
                      @if (isRemovingFromWatchlist()) {
                        <div class="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                        Removing...
                      } @else {
                        <lucide-icon name="trash-2" class="h-4 w-4"></lucide-icon>
                        Remove from Watchlist
                      }
                    </button>
                  } @else {
                    <button
                      (click)="addToWatchlist()"
                      [disabled]="isAddingToWatchlist() || isRemovingFromWatchlist() || isInWatchlist()"
                      class="st-pill relative inline-flex items-center gap-2 overflow-hidden text-xs font-mono uppercase tracking-widest transition-all duration-200 disabled:cursor-not-allowed"
                      [ngClass]="
                        isInWatchlist()
                          ? 'bg-black text-white'
                          : 'bg-black text-white hover:bg-black/80'
                      "
                    >
                      @if (showAddTickPulse()) {
                        <span class="absolute inset-0 animate-ping bg-black/25"></span>
                      }

                      @if (isAddingToWatchlist()) {
                        <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Adding...
                      } @else if (isInWatchlist()) {
                        <lucide-icon name="check" class="h-4 w-4"></lucide-icon>
                        Added
                      } @else {
                        <lucide-icon name="plus" class="h-4 w-4"></lucide-icon>
                        Add to Watchlist
                      }
                    </button>
                  }

                  @if (showAddTickPulse()) {
                    <span class="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-black/80">
                      <lucide-icon name="check" class="h-3.5 w-3.5"></lucide-icon>
                      Added to Watchlist
                    </span>
                  }

                  <a
                    [routerLink]="['/watchlist']"
                    class="st-pill inline-flex items-center gap-2 border border-black/15 bg-white text-xs font-mono uppercase tracking-widest text-black/85 no-underline transition-colors hover:bg-black/5"
                  >
                    <lucide-icon name="bookmark" class="h-4 w-4"></lucide-icon>
                    View Watchlist
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              <h2 class="mb-4 text-xl font-semibold tracking-tight">Top Cast</h2>
              @if (castMembers().length > 0) {
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  @for (member of castMembers(); track member.id) {
                    <article class="st-card overflow-hidden border border-black/10 bg-white">
                      <img
                        [src]="member.profile_url || fallbackCastImage(member.id)"
                        [alt]="member.name"
                        class="st-card aspect-[3/4] w-full object-cover"
                      />
                      <div class="p-3">
                        <h3 class="truncate text-sm font-medium text-black">{{ member.name }}</h3>
                        <p class="mt-1 truncate text-xs text-black/60">{{ member.character || 'Cast' }}</p>
                      </div>
                    </article>
                  }
                </div>
              } @else {
                <p class="text-sm text-black/60">Cast details are not available.</p>
              }
            </div>

            <div>
              <h2 class="mb-4 text-xl font-semibold tracking-tight">Trailer</h2>
              @if (trailerUrl(); as safeUrl) {
                <div class="overflow-hidden rounded-2xl border border-black/10 bg-black">
                  <iframe
                    class="aspect-video w-full"
                    [src]="safeUrl"
                    title="Trailer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                  ></iframe>
                </div>
              } @else {
                <div class="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/60">
                  Trailer is not available for this title.
                </div>
              }
            </div>
          </div>
        </section>

        <section class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div class="mb-4 flex items-center justify-between gap-4">
            <h2 class="text-xl font-semibold tracking-tight">Similar Recommendations</h2>
            @if (similarTotalPages() > 1) {
              <p class="m-0 text-[11px] font-mono uppercase tracking-widest text-black/55">
                Page {{ similarPage() }} / {{ similarTotalPages() }}
              </p>
            }
          </div>

          @if (similarLoading()) {
            <div class="py-12 text-center text-sm text-black/60">Loading similar titles...</div>
          } @else if (similarItems().length === 0) {
            <div class="rounded-2xl border border-black/10 bg-white p-8 text-sm text-black/60">
              No similar recommendations available.
            </div>
          } @else {
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
              @for (item of similarItems(); track item.id) {
                <app-show-card [item]="item" [mode]="'grid'"></app-show-card>
              }
            </div>

            @if (similarTotalPages() > 1) {
              <div class="mt-8 flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3">
                <button
                  type="button"
                  (click)="goToSimilarPage(similarPage() - 1)"
                  [disabled]="similarPage() <= 1"
                  class="rounded-full border border-black/15 px-4 py-2 text-[11px] font-mono uppercase tracking-widest text-black transition-colors enabled:hover:bg-black enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  (click)="goToSimilarPage(similarPage() + 1)"
                  [disabled]="similarPage() >= similarTotalPages()"
                  class="rounded-full border border-black/15 px-4 py-2 text-[11px] font-mono uppercase tracking-widest text-black transition-colors enabled:hover:bg-black enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            }
          }
        </section>
      }
    </div>
  `,
})
export class ContentDetailsPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private contentService = inject(ContentService);
  private authService = inject(AuthService);
  private sanitizer = inject(DomSanitizer);
  watchlistService = inject(WatchlistService);

  private routeSub?: Subscription;
  private requestId = 0;
  private similarCache = new Map<string, PagedContentResponse>();

  goBack(): void {
    this.location.back();
  }

  currentType = signal<'movie' | 'tv'>('movie');
  currentId = signal<number | null>(null);

  content = signal<ContentItem | null>(null);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  isAddingToWatchlist = signal(false);
  isRemovingFromWatchlist = signal(false);
  showAddTickPulse = signal(false);
  isInWatchlist = signal(false);
  watchlistStatus = signal<'want' | 'watching' | 'watched' | null>(null);

  releaseYear = signal<string>('');
  providers = signal<ProviderUi[]>([]);
  trailerUrl = signal<SafeResourceUrl | null>(null);

  similarItems = signal<ContentItem[]>([]);
  similarPage = signal(1);
  similarTotalPages = signal(1);
  similarTotalResults = signal(0);
  similarLoading = signal(false);

  castMembers = computed(() => (this.content()?.castMembers || []).slice(0, 5));
  heroBackdrop = computed(() => {
    const detail = this.content();
    if (!detail) return '';
    return this.watchlistService.getBackdropUrl(detail.backdrop_path || detail.poster_path);
  });

  ngOnInit(): void {
    this.routeSub = combineLatest([this.route.paramMap, this.route.data]).subscribe(
      ([params, data]) => {
        const resolvedType = this.resolveType(params.get('type'), data['type']);
        const id = this.extractTmdbId(params.get('id'));

        if (!id) {
          this.errorMessage.set('Invalid content ID');
          return;
        }

        this.currentType.set(resolvedType);
        this.currentId.set(id);
        this.applyPreviewState(resolvedType, id);
        void this.loadContent(resolvedType, id);
      },
    );
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  async goToSimilarPage(page: number): Promise<void> {
    const nextPage = Math.max(1, Math.min(this.similarTotalPages(), page));
    if (nextPage === this.similarPage()) return;

    await this.loadSimilarPage(nextPage);
  }

  addToWatchlist(): void {
    if (!this.authService.isAuthenticated()) {
      void this.router.navigate(['/login']);
      return;
    }

    const detail = this.content();
    if (!detail || this.isAddingToWatchlist() || this.isRemovingFromWatchlist() || this.isInWatchlist()) return;

    this.isAddingToWatchlist.set(true);
    const contentId = this.toContentId(detail);

    this.watchlistService
      .addWatchlistItem({
        contentId,
        title: detail.title || detail.name || 'Unknown',
        type: detail.type,
        posterPath: detail.poster_path,
        backdropPath: detail.backdrop_path,
        status: 'want',
      })
      .subscribe({
        next: () => {
          this.isAddingToWatchlist.set(false);
          this.isInWatchlist.set(true);
          this.watchlistStatus.set('want');
          this.playAddTickPulse();
        },
        error: (error) => {
          this.isAddingToWatchlist.set(false);
          if (this.isAlreadyAddedError(error)) {
            this.isInWatchlist.set(true);
            this.playAddTickPulse();
            return;
          }
          console.error('Error adding to watchlist:', error);
        },
      });
  }

  removeFromWatchlist(): void {
    const detail = this.content();
    if (!detail || this.isRemovingFromWatchlist()) return;

    this.isRemovingFromWatchlist.set(true);
    const contentId = this.toContentId(detail);

    this.watchlistService.removeWatchlistItem(contentId).subscribe({
      next: () => {
        this.isRemovingFromWatchlist.set(false);
        this.isInWatchlist.set(false);
        this.watchlistStatus.set(null);
      },
      error: (err) => {
        this.isRemovingFromWatchlist.set(false);
        console.error('Error removing from watchlist:', err);
      },
    });
  }

  updateWatchlistStatus(newStatus: 'want' | 'watching' | 'watched'): void {
    const detail = this.content();
    if (!detail) return;

    const contentId = this.toContentId(detail);
    this.watchlistService.updateWatchlistItem(contentId, { status: newStatus }).subscribe({
      next: () => {
        this.watchlistStatus.set(newStatus);
      },
      error: (err) => console.error('Error updating watchlist status:', err),
    });
  }

  fallbackCastImage(seed: number): string {
    return `https://picsum.photos/seed/cast-${seed}/300/400`;
  }

  private async loadContent(type: 'movie' | 'tv', id: number): Promise<void> {
    const callId = ++this.requestId;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.isInWatchlist.set(false);
    this.watchlistStatus.set(null);
    this.showAddTickPulse.set(false);
    this.isRemovingFromWatchlist.set(false);

    try {
      const detail =
        type === 'movie'
          ? await firstValueFrom(this.contentService.getMovieDetails(id))
          : await firstValueFrom(this.contentService.getTvDetails(id));

      if (callId !== this.requestId) return;

      this.content.set(detail);
      this.releaseYear.set((detail.release_date || detail.first_air_date || '').split('-')[0] || '');
      this.providers.set(this.mapProviders(detail.watchProviders || []));
      this.trailerUrl.set(
        detail.trailer?.embedUrl
          ? this.sanitizer.bypassSecurityTrustResourceUrl(detail.trailer.embedUrl)
          : null,
      );

      // Check if this item is in the watchlist and get its status
      const contentId = this.toContentId(detail);
      this.watchlistService.getWatchlist().pipe(
        map((items) => items.find((i) => i.contentId === contentId)),
      ).subscribe((item) => {
        if (item) {
          this.isInWatchlist.set(true);
          this.watchlistStatus.set(item.status);
          return;
        }

        this.isInWatchlist.set(false);
        this.watchlistStatus.set(null);
      });

      const initialSimilar = detail.similar;
      if (initialSimilar && initialSimilar.results.length > 0) {
        const normalized: PagedContentResponse = {
          results: initialSimilar.results,
          page: initialSimilar.page,
          totalPages: initialSimilar.totalPages,
          totalResults: initialSimilar.totalResults,
        };
        this.setSimilarState(normalized);
        this.similarCache.set(this.similarCacheKey(type, id, normalized.page), normalized);
      } else {
        this.similarItems.set([]);
        this.similarPage.set(1);
        this.similarTotalPages.set(1);
        this.similarTotalResults.set(0);
        void this.loadSimilarPage(1);
      }

      const next = this.similarPage() + 1;
      if (next <= this.similarTotalPages()) {
        void this.preloadSimilarPage(type, id, next);
      }
    } catch (error) {
      if (callId !== this.requestId) return;
      console.error('Error loading content details:', error);
      this.errorMessage.set('Could not load content details. Please try again.');
      this.content.set(null);
    } finally {
      if (callId === this.requestId) {
        this.isLoading.set(false);
      }
    }
  }

  private async loadSimilarPage(page: number, skipLoadingState = false): Promise<void> {
    const type = this.currentType();
    const id = this.currentId();
    if (!id) return;

    const cacheKey = this.similarCacheKey(type, id, page);
    const cached = this.similarCache.get(cacheKey);
    if (cached) {
      this.setSimilarState(cached);
      return;
    }

    if (!skipLoadingState) {
      this.similarLoading.set(true);
    }

    try {
      const response = await firstValueFrom(this.contentService.getSimilar(type, id, page));
      this.similarCache.set(cacheKey, response);
      this.setSimilarState(response);

      const next = response.page + 1;
      if (next <= response.totalPages) {
        void this.preloadSimilarPage(type, id, next);
      }
    } catch (error) {
      console.error('Error loading similar recommendations:', error);
      this.similarItems.set([]);
      this.similarPage.set(1);
      this.similarTotalPages.set(1);
      this.similarTotalResults.set(0);
    } finally {
      this.similarLoading.set(false);
    }
  }

  private async preloadSimilarPage(type: 'movie' | 'tv', id: number, page: number): Promise<void> {
    const cacheKey = this.similarCacheKey(type, id, page);
    if (this.similarCache.has(cacheKey)) return;

    try {
      const response = await firstValueFrom(this.contentService.getSimilar(type, id, page));
      this.similarCache.set(cacheKey, response);
    } catch {
      // Ignore preload failures.
    }
  }

  private setSimilarState(response: PagedContentResponse): void {
    this.similarItems.set(response.results);
    this.similarPage.set(response.page || 1);
    this.similarTotalPages.set(Math.max(1, response.totalPages || 1));
    this.similarTotalResults.set(response.totalResults || response.results.length);
  }

  private mapProviders(providerIds: string[]): ProviderUi[] {
    const unique = Array.from(new Set(providerIds));
    return unique.map((providerId) => {
      const mapped = PROVIDER_UI[providerId];
      if (mapped) return mapped;

      return {
        id: providerId,
        label: providerId,
        colorClass: 'bg-black/[0.04] text-black/80 border border-black/10',
      };
    });
  }

  private resolveType(
    typeParam: string | null,
    dataType: unknown,
  ): 'movie' | 'tv' {
    if (dataType === 'movie' || dataType === 'tv') {
      return dataType;
    }

    if (typeParam === 'movie' || typeParam === 'tv') {
      return typeParam;
    }

    const url = this.router.url;
    return url.startsWith('/tv/') ? 'tv' : 'movie';
  }

  private extractTmdbId(id: string | null): number | null {
    if (!id) return null;
    if (id.includes('-')) {
      const parts = id.split('-');
      const lastPart = parts[parts.length - 1];
      const num = Number.parseInt(lastPart, 10);
      return Number.isNaN(num) ? null : num;
    }

    const num = Number.parseInt(id, 10);
    return Number.isNaN(num) ? null : num;
  }

  private applyPreviewState(type: 'movie' | 'tv', id: number): void {
    const preview = (history.state?.preview as ContentItem | undefined) || undefined;
    if (!preview) return;

    const previewId =
      typeof preview.tmdbId === 'number'
        ? preview.tmdbId
        : this.extractTmdbId(String(preview.id));

    if (!previewId || previewId !== id || preview.type !== type) {
      return;
    }

    this.content.set({
      ...preview,
      type,
    });
    this.releaseYear.set((preview.release_date || preview.first_air_date || '').split('-')[0] || '');
    this.providers.set(this.mapProviders(preview.watchProviders || []));
  }

  private similarCacheKey(type: 'movie' | 'tv', id: number, page: number): string {
    return `${type}-${id}-${page}`;
  }

  private toContentId(detail: ContentItem): string {
    if (typeof detail.tmdbId === 'number' && detail.tmdbId > 0) {
      return `${detail.type}-${detail.tmdbId}`;
    }

    const rawId = String(detail.id);
    return rawId.includes('-') ? rawId : `${detail.type}-${rawId}`;
  }

  private isAlreadyAddedError(error: unknown): boolean {
    const status =
      typeof (error as { status?: unknown })?.status === 'number'
        ? (error as { status: number }).status
        : undefined;
    const message = [
      error instanceof Error ? error.message : '',
      (error as { error?: { error?: string } })?.error?.error || '',
    ]
      .join(' ')
      .toLowerCase();

    return (
      status === 409 ||
      message.includes('already in watchlist') ||
      message.includes('already added')
    );
  }

  private playAddTickPulse(): void {
    this.showAddTickPulse.set(true);
    setTimeout(() => this.showAddTickPulse.set(false), 600);
  }
}
