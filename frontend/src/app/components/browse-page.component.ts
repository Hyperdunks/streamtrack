import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, combineLatest, firstValueFrom } from 'rxjs';
import { ContentGridComponent } from './content-grid.component';
import {
  ContentItem,
  ContentService,
  DiscoverGenre,
  PagedContentResponse,
} from '../services/content.service';
import { StateService } from '../services/state.service';

type BrowseCategory = 'trending' | 'movies' | 'tv' | 'anime';
type SearchSort = 'relevance' | 'genre-asc' | 'genre-desc';

interface BrowseConfig {
  title: string;
}

const BROWSE_CONFIG: Record<BrowseCategory, BrowseConfig> = {
  trending: { title: 'Trending Now' },
  movies: { title: 'All Movies' },
  tv: { title: 'All TV Shows' },
  anime: { title: 'Anime Picks' },
};

@Component({
  selector: 'app-browse-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ContentGridComponent],
  template: `
    <section class="py-4 lg:py-6">
      <div class="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-black">{{ title() }}</h1>
          <p class="text-[11px] font-mono text-black/50 uppercase tracking-widest mt-2">
            @if (hasSearch()) {
              {{ displayedCount() }} of {{ totalResults() }} search matches
            } @else {
              {{ totalResults() }} titles found
            }
          </p>
        </div>
        <a
          routerLink="/"
          class="text-[11px] font-mono text-black/60 uppercase tracking-widest hover:text-black transition-colors no-underline"
        >Back to Home</a
        >
      </div>

      @if (hasSearch()) {
        <div class="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-3 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-[10px] font-mono uppercase tracking-widest text-black/55">
              Filter by Genre
            </label>
            <select
              [value]="selectedGenreValue()"
              (change)="onGenreChange($event)"
              class="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none transition-colors focus:border-black/40"
            >
              <option value="all">All genres</option>
              @for (genre of availableGenres(); track genre.id) {
                <option [value]="genre.id">{{ genre.name }}</option>
              }
            </select>
          </div>

          <div>
            <label class="mb-1.5 block text-[10px] font-mono uppercase tracking-widest text-black/55">
              Sort
            </label>
            <select
              [value]="searchSort()"
              (change)="onSortChange($event)"
              class="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none transition-colors focus:border-black/40"
            >
              <option value="relevance">Relevance</option>
              <option value="genre-asc">Genre A-Z</option>
              <option value="genre-desc">Genre Z-A</option>
            </select>
          </div>
        </div>
      }

      @if (isLoading()) {
        <div class="py-16 text-center text-black/60 font-mono text-sm uppercase tracking-widest">
          {{ loadingMessage() }}
        </div>
      } @else if (displayedItems().length === 0) {
        <div class="py-16 text-center text-black/60 font-mono text-sm uppercase tracking-widest">
          @if (hasSearch()) {
            No results found for your search.
          } @else {
            No titles found.
          }
        </div>
      } @else {
        <app-content-grid
          [title]="title()"
          [items]="displayedItems()"
          [maxItems]="null"
          [layout]="'grid'"
        ></app-content-grid>

        @if (hasPagination()) {
          <div
            class="mt-10 flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3"
          >
            <button
              type="button"
              (click)="goToPage(page() - 1)"
              [disabled]="!canGoPrev()"
              class="rounded-full border border-black/10 px-4 py-2 text-[11px] font-mono uppercase tracking-widest text-black transition-colors enabled:hover:bg-black enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <p class="text-[11px] font-mono uppercase tracking-widest text-black/70 m-0">
              Page {{ page() }} / {{ totalPages() }}
            </p>

            <button
              type="button"
              (click)="goToPage(page() + 1)"
              [disabled]="!canGoNext()"
              class="rounded-full border border-black/10 px-4 py-2 text-[11px] font-mono uppercase tracking-widest text-black transition-colors enabled:hover:bg-black enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        }
      }
    </section>
  `,
})
export class BrowsePageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private contentService = inject(ContentService);
  private state = inject(StateService);
  private routeSub?: Subscription;
  private requestId = 0;
  private pageCache = new Map<string, PagedContentResponse>();

  title = signal('Browse');
  items = signal<ContentItem[]>([]);
  page = signal(1);
  totalPages = signal(1);
  totalResults = signal(0);
  query = signal('');
  genres = signal<DiscoverGenre[]>([]);
  selectedGenreId = signal<number | null>(null);
  searchSort = signal<SearchSort>('relevance');
  isLoading = signal(true);
  loadingMessage = signal('Loading titles...');

  hasSearch = computed(() => this.query().length > 0);
  availableGenres = computed(() => {
    const genreMap = new Map<number, string>();

    this.items().forEach((item) => {
      (item.genre_ids || []).forEach((genreId) => {
        const name = this.genreNameById(genreId);
        if (name) {
          genreMap.set(genreId, name);
        }
      });
    });

    return Array.from(genreMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  displayedItems = computed(() => {
    if (!this.hasSearch()) {
      return this.items();
    }

    const selectedGenreId = this.selectedGenreId();
    const filtered = selectedGenreId
      ? this.items().filter((item) => (item.genre_ids || []).includes(selectedGenreId))
      : [...this.items()];

    const sortMode = this.searchSort();
    if (sortMode === 'relevance') {
      return filtered;
    }

    const direction = sortMode === 'genre-asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const genreA = this.primaryGenreName(a);
      const genreB = this.primaryGenreName(b);
      const byGenre = genreA.localeCompare(genreB) * direction;

      if (byGenre !== 0) {
        return byGenre;
      }

      const titleA = (a.title || a.name || '').toLowerCase();
      const titleB = (b.title || b.name || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });
  });
  displayedCount = computed(() => this.displayedItems().length);
  canGoPrev = computed(() => this.page() > 1);
  canGoNext = computed(() => this.page() < this.totalPages());
  hasPagination = computed(() => this.totalPages() > 1);

  ngOnInit(): void {
    this.loadGenres();

    this.routeSub = combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(
      ([params, queryParams]) => {
        const category = this.resolveCategory(params.get('category'));
        const config = BROWSE_CONFIG[category];
        const page = this.parsePage(queryParams.get('page'));
        const query = (queryParams.get('q') || '').trim();
        const selectedGenreId = this.parseGenreId(queryParams.get('genre'));
        const searchSort = this.parseSearchSort(queryParams.get('sort'));

        this.title.set(config.title);
        this.page.set(page);
        this.query.set(query);
        this.selectedGenreId.set(query ? selectedGenreId : null);
        this.searchSort.set(query ? searchSort : 'relevance');
        this.state.searchQuery.set(query);

        void this.loadPage(category, page, query);
      },
    );
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  async goToPage(targetPage: number): Promise<void> {
    const nextPage = Math.max(1, Math.min(this.totalPages(), targetPage));
    if (nextPage === this.page()) return;

    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: nextPage,
        q: this.query() || null,
        genre: this.selectedGenreId() || null,
        sort: this.searchSort() === 'relevance' ? null : this.searchSort(),
      },
      queryParamsHandling: 'merge',
    });
  }

  selectedGenreValue(): string {
    return this.selectedGenreId() ? String(this.selectedGenreId()) : 'all';
  }

  onGenreChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const genre = this.parseGenreId(value);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: 1,
        genre: genre || null,
      },
      queryParamsHandling: 'merge',
    });
  }

  onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const sort = this.parseSearchSort(value);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: 1,
        sort: sort === 'relevance' ? null : sort,
      },
      queryParamsHandling: 'merge',
    });
  }

  private async loadPage(category: BrowseCategory, page: number, query: string): Promise<void> {
    const callId = ++this.requestId;
    this.isLoading.set(true);

    try {
      this.loadingMessage.set(this.getLoadingMessage(category, query));
      const response = await this.fetchPage(category, page, query);
      if (callId !== this.requestId) return;

      this.items.set(response.results);
      this.totalPages.set(Math.max(1, response.totalPages || 1));
      this.totalResults.set(response.totalResults || response.results.length);
      this.page.set(response.page || page);

      const nextPage = (response.page || page) + 1;
      if (nextPage <= this.totalPages()) {
        void this.preloadPage(category, nextPage, query);
      }
    } catch (error) {
      if (callId !== this.requestId) return;
      console.error('Error loading browse page content:', error);
      this.items.set([]);
      this.totalPages.set(1);
      this.totalResults.set(0);
    } finally {
      if (callId === this.requestId) {
        this.isLoading.set(false);
      }
    }
  }

  private async fetchPage(
    category: BrowseCategory,
    page: number,
    query: string,
  ): Promise<PagedContentResponse> {
    const cacheKey = this.buildCacheKey(category, page, query);
    const cached = this.pageCache.get(cacheKey);
    if (cached) return cached;

    const response = await firstValueFrom(this.getPageRequest(category, page, query));
    const normalized: PagedContentResponse = {
      results: response.results,
      page: response.page || page,
      totalPages: response.totalPages || 1,
      totalResults: response.totalResults || response.results.length,
    };

    this.pageCache.set(cacheKey, normalized);
    return normalized;
  }

  private async preloadPage(category: BrowseCategory, page: number, query: string): Promise<void> {
    const cacheKey = this.buildCacheKey(category, page, query);
    if (this.pageCache.has(cacheKey)) return;

    try {
      await this.fetchPage(category, page, query);
    } catch {
      // Ignore preload errors to keep UX stable.
    }
  }

  private getPageRequest(category: BrowseCategory, page: number, query: string) {
    const providerId = this.state.selectedProviderId();
    const watchRegion = this.state.selectedWatchRegion();

    if (query) {
      const type: 'movie' | 'tv' | 'all' =
        category === 'movies' ? 'movie' : category === 'tv' ? 'tv' : 'all';
      return this.contentService.search(query, page, type);
    }

    if (category === 'movies') {
      return this.contentService.getMoviesPage(page, providerId, watchRegion);
    }

    if (category === 'tv') {
      return this.contentService.getTvShowsPage(page, providerId, watchRegion);
    }

    if (category === 'anime') {
      return this.contentService.getAnimePage(page);
    }

    return this.contentService.getTrendingPage('all', 'week', page, providerId, watchRegion);
  }

  private getLoadingMessage(category: BrowseCategory, query: string): string {
    if (query) {
      return `Searching for "${query}"...`;
    }

    if (category === 'movies') return 'Loading movies...';
    if (category === 'tv') return 'Loading TV shows...';
    if (category === 'anime') return 'Loading anime picks...';
    return 'Loading trending titles...';
  }

  private loadGenres(): void {
    this.contentService.getDiscoverGenres().subscribe({
      next: (genres) => {
        this.genres.set(genres || []);
      },
      error: (error) => {
        console.error('Error loading genres for search filters:', error);
        this.genres.set([]);
      },
    });
  }

  private buildCacheKey(category: BrowseCategory, page: number, query: string): string {
    return `${category}|${query.toLowerCase()}|${page}`;
  }

  private parseGenreId(value: string | null): number | null {
    if (!value || value === 'all') return null;

    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return null;
    return parsed;
  }

  private parseSearchSort(value: string | null): SearchSort {
    if (value === 'genre-asc' || value === 'genre-desc') {
      return value;
    }

    return 'relevance';
  }

  private genreNameById(genreId: number): string {
    return this.genres().find((genre) => genre.id === genreId)?.name || '';
  }

  private primaryGenreName(item: ContentItem): string {
    const names = (item.genre_ids || [])
      .map((genreId) => this.genreNameById(genreId))
      .filter((name) => !!name)
      .sort((a, b) => a.localeCompare(b));

    return names[0] || 'zzzz';
  }

  private parsePage(value: string | null): number {
    const parsed = Number.parseInt(value || '1', 10);
    if (Number.isNaN(parsed)) return 1;
    return Math.max(1, parsed);
  }

  private resolveCategory(value: string | null): BrowseCategory {
    if (value === 'movies' || value === 'tv' || value === 'trending' || value === 'anime') {
      return value;
    }

    return 'trending';
  }
}
