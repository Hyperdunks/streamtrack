import {
  Component,
  signal,
  computed,
  HostListener,
  ElementRef,
  ViewChild,
  inject,
  ViewChildren,
  QueryList,
  effect,
  AfterViewInit,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { StateService } from '../services/state.service';
import { WatchlistService, WatchlistItem } from '../services/watchlist.service';

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  animations: [
    trigger('listAnimation', [
      transition('* => *', [
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateY(50px) translateX(20px) scale(0.98)' }),
            stagger(50, [
              animate(
                '800ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                style({ opacity: 1, transform: 'translateY(0) translateX(0) scale(1)' }),
              ),
            ]),
          ],
          { optional: true },
        ),
      ]),
    ]),
  ],
  template: `
    <section class="border-t border-black/10 pt-12 reveal delay-4">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div class="flex flex-wrap gap-8 md:gap-12 relative pb-2 overflow-x-auto no-scrollbar">
          @for (tab of tabs(); track tab.id) {
            <button
              #tabButton
              (click)="handleTabClick(tab.id)"
              class="bg-none border-none text-[13px] font-semibold cursor-pointer relative transition-all duration-300 z-10 whitespace-nowrap px-1"
              [ngClass]="
                activeTab() === tab.id
                  ? 'text-black tracking-tight'
                  : 'text-black/60 hover:text-black/80 tracking-normal'
              "
            >
              {{ tab.label }}
            </button>
          }
          <!-- Sliding Indicator -->
          <div
            class="absolute bottom-0 h-[2px] bg-black transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) z-0"
            [style.left.px]="indicatorLeft()"
            [style.width.px]="indicatorWidth()"
          ></div>
        </div>
        <div class="flex items-center gap-3">
          <div class="relative" #genreDropdownRef>
            <button
              (click)="isGenreDropdownOpen.set(!isGenreDropdownOpen())"
              class="flex items-center gap-2 px-3 py-1.5 bg-black/5 hover:bg-black/10 border border-black/10 rounded-md font-mono text-[10px] text-black uppercase tracking-widest transition-colors cursor-pointer"
            >
              {{ selectedGenre() === 'All' ? 'All Genres' : selectedGenre() }}
              <lucide-icon name="chevron-down" class="w-3 h-3"></lucide-icon>
            </button>
            @if (isGenreDropdownOpen()) {
              <div
                class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-black/10 overflow-hidden z-50 py-1"
              >
                @for (genre of allGenres(); track genre) {
                  <button
                    (click)="selectGenre(genre)"
                    class="w-full text-left px-4 py-2 text-[11px] font-mono hover:bg-black/5 transition-colors border-none cursor-pointer"
                    [ngClass]="
                      selectedGenre() === genre
                        ? 'text-black font-bold bg-black/5'
                        : 'text-black/80'
                    "
                  >
                    {{ genre }}
                  </button>
                }
              </div>
            }
          </div>
        </div>
      </div>

      @if (filteredItems().length === 0) {
        <div class="py-20 text-center text-black/60 font-mono text-sm">
          No items found for this filter.
        </div>
      }

      <div [@listAnimation]="activeTab() + selectedGenre() + currentPage()">
        @if (filteredItems().length > 0) {
          <div class="flex flex-col gap-10">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              @for (item of paginatedItems(); track item.contentId) {
                <div
                  (click)="openDetails(item)"
                  (keydown.enter)="openDetails(item)"
                  tabindex="0"
                  class="group cursor-pointer flex flex-col gap-4 transition-all duration-500"
                >
                  <div
                    class="relative aspect-[2/3] rounded-2xl overflow-hidden transition-all duration-500 group-hover:-translate-y-2"
                  >
                    <img
                      [src]="watchlistService.getImageUrl(item.posterPath)"
                      [alt]="item.title"
                      referrerpolicy="no-referrer"
                      class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />

                    <div
                      class="absolute inset-0 bg-[#fcfcfd]/40 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6"
                    >
                      <div
                        class="translate-y-4 group-hover:translate-y-0 transition-transform duration-500"
                      >
                        <div class="flex gap-1 mb-3">
                          @for (star of [1, 2, 3, 4, 5]; track star) {
                            <lucide-icon
                              name="star"
                              class="w-3.5 h-3.5"
                              [ngClass]="
                                star <= (item.rating ?? 0) / 2
                                  ? 'fill-black text-black'
                                  : 'text-black/30'
                              "
                            ></lucide-icon>
                          }
                        </div>
                        <p
                          class="text-black text-[10px] font-mono uppercase tracking-widest mb-2 line-clamp-1"
                        >
                          {{ item.genre }}
                        </p>
                        <div class="flex items-center gap-2">
                          <span
                            class="bg-black text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter"
                            >HD</span
                          >
                          <span class="text-black text-[10px] font-mono">{{ item.runtime }}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    >
                      <button
                        type="button"
                        (click)="removeFromWatchlist(item, $event)"
                        class="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-black/30 text-black flex items-center justify-center hover:bg-white hover:text-black transition-colors"
                        [disabled]="isRemovingItem(item.contentId)"
                        aria-label="Remove from watchlist"
                      >
                        @if (isRemovingItem(item.contentId)) {
                          <div class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                        } @else {
                          <lucide-icon name="trash-2" class="w-4 h-4"></lucide-icon>
                        }
                      </button>
                    </div>
                  </div>

                  <div class="px-1">
                    <div class="flex items-start justify-between gap-2 mb-1">
                      <h3
                        class="font-bold text-base text-black leading-tight group-hover:text-black/80 transition-colors"
                      >
                        {{ item.title }}
                      </h3>
                      <span class="text-[10px] font-mono text-black/60 mt-1">{{ item.year }}</span>
                    </div>
                    <p
                      class="font-mono text-[10px] text-black/80 uppercase tracking-wider truncate"
                    >
                      {{ item.director }}
                    </p>
                  </div>
                </div>
              }
            </div>

            @if (totalPages() > 1) {
              <div class="flex items-center justify-center gap-2 py-4">
                <button
                  (click)="setCurrentPage(currentPage() - 1)"
                  [disabled]="currentPage() === 1"
                  class="px-3 py-1.5 rounded-md font-mono text-[10px] bg-black/5 text-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/10 transition-colors border border-black/10 cursor-pointer uppercase tracking-widest"
                >
                  Prev
                </button>
                <div class="flex gap-1">
                  @for (page of pageNumbers(); track page) {
                    <button
                      (click)="setCurrentPage(page)"
                      class="w-7 h-7 rounded-md font-mono text-[10px] flex items-center justify-center transition-colors border-none cursor-pointer"
                      [ngClass]="
                        currentPage() === page
                          ? 'bg-black text-white'
                          : 'bg-transparent text-black/60 hover:text-black/10 hover:text-black'
                      "
                    >
                      {{ page }}
                    </button>
                  }
                </div>
                <button
                  (click)="setCurrentPage(currentPage() + 1)"
                  [disabled]="currentPage() === totalPages()"
                  class="px-3 py-1.5 rounded-md font-mono text-[10px] bg-black/5 text-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/10 transition-colors border border-black/10 cursor-pointer uppercase tracking-widest"
                >
                  Next
                </button>
              </div>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class WatchlistComponent implements OnInit, AfterViewInit {
  private router = inject(Router);
  state = inject(StateService);
  watchlistService = inject(WatchlistService);

  private platformAliases: Record<string, string[]> = {
    netflix: ['netflix'],
    primevideo: ['primevideo', 'prime', 'amazonprime', 'amazonprimevideo'],
    jiohotstar: ['jiohotstar', 'hotstar', 'disneyplushotstar'],
    zee5: ['zee5'],
    sonyliv: ['sonyliv'],
  };

  activeTab = signal<'want' | 'watching' | 'watched'>('want');
  expandedId = signal<string | null>(null);

  currentPage = signal(1);
  itemsPerPage = 10;
  selectedGenre = signal('All');
  isGenreDropdownOpen = signal(false);

  indicatorLeft = signal(0);
  indicatorWidth = signal(0);

  @ViewChildren('tabButton') tabButtons!: QueryList<ElementRef>;

  constructor() {
    effect(() => {
      // Trigger update when active tab changes
      const _ = this.activeTab();
      // Use setTimeout to ensure ViewChildren are rendered
      setTimeout(() => this.updateIndicator());
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.updateIndicator();
  }

  ngAfterViewInit() {
    // Initial calculation
    setTimeout(() => this.updateIndicator(), 100);
  }

  updateIndicator() {
    if (!this.tabButtons) return;
    const tabIndex = this.tabs().findIndex((t) => t.id === this.activeTab());
    const button = this.tabButtons.toArray()[tabIndex];
    if (button) {
      const el = button.nativeElement;
      this.indicatorLeft.set(el.offsetLeft);
      this.indicatorWidth.set(el.offsetWidth);
    }
  }

  items = signal<WatchlistItem[]>([]);
  private removingIds = signal<Set<string>>(new Set());

  ngOnInit() {
    this.loadWatchlist();
  }

  loadWatchlist() {
    this.watchlistService.getWatchlist().subscribe({
      next: (items) => {
        this.items.set(items);
      },
      error: (err) => console.error('Error loading watchlist:', err),
    });
  }

  allGenres = computed(() => {
    const genres = new Set(this.items().flatMap((item) => item.genre?.split(' / ') ?? []));
    return ['All', ...Array.from(genres)].sort((a, b) => {
      if (a === 'All') return -1;
      if (b === 'All') return 1;
      return a.localeCompare(b);
    });
  });

  filteredItems = computed(() => {
    return this.items().filter((item) => {
      const matchesTab = item.status === this.activeTab();
      const matchesPill = this.matchesActivePill(item);
      const matchesGenre =
        this.selectedGenre() === 'All' || (item.genre?.includes(this.selectedGenre()) ?? false);
      const matchesVibe =
        !this.state.activeVibe() || (item.vibes?.includes(this.state.activeVibe()!) ?? false);
      return matchesTab && matchesPill && matchesGenre && matchesVibe;
    });
  });

  totalPages = computed(() => Math.ceil(this.filteredItems().length / this.itemsPerPage));

  paginatedItems = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    return this.filteredItems().slice(start, start + this.itemsPerPage);
  });

  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  tabs = computed<{ id: 'want' | 'watching' | 'watched'; label: string }[]>(() => [
    { id: 'want', label: `WISHLIST (${this.items().filter((i) => i.status === 'want').length})` },
    {
      id: 'watching',
      label: `CURRENTLY WATCHING (${this.items().filter((i) => i.status === 'watching').length})`,
    },
    {
      id: 'watched',
      label: `WATCHED (${this.items().filter((i) => i.status === 'watched').length})`,
    },
  ]);

  @ViewChild('genreDropdownRef') genreDropdownRef!: ElementRef;

  @HostListener('document:mousedown', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.genreDropdownRef && !this.genreDropdownRef.nativeElement.contains(event.target)) {
      this.isGenreDropdownOpen.set(false);
    }
  }

  handleTabClick(tab: 'want' | 'watching' | 'watched') {
    if (tab === this.activeTab()) return;
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.expandedId.set(null);
  }

  selectGenre(genre: string) {
    this.selectedGenre.set(genre);
    this.isGenreDropdownOpen.set(false);
    this.currentPage.set(1);
  }

  toggleStatus(contentId: string, newStatus: 'want' | 'watching' | 'watched') {
    const item = this.items().find((i) => i.contentId === contentId);
    if (!item) return;

    this.watchlistService.updateWatchlistItem(item.contentId, { status: newStatus }).subscribe({
      next: (updatedItem) => {
        this.items.update((items) =>
          items.map((i) => (i.contentId === contentId ? updatedItem : i)),
        );
      },
      error: (err) => console.error('Error updating status:', err),
    });
  }

  setCurrentPage(page: number) {
    this.currentPage.set(page);
  }

  openDetails(item: WatchlistItem) {
    // contentId format is "movie-123" or "tv-456"
    const parts = item.contentId.split('-');
    const type = parts[0]; // 'movie' or 'tv'
    const id = parts.slice(1).join('-'); // handles edge cases
    const parsedTmdbId = Number.parseInt(id, 10);

    void this.router.navigate(['/', type, id], {
      state: {
        preview: {
          id: item.contentId,
          tmdbId: Number.isInteger(parsedTmdbId) && parsedTmdbId > 0 ? parsedTmdbId : undefined,
          type: type === 'tv' ? 'tv' : 'movie',
          title: item.title,
          name: type === 'tv' ? item.title : undefined,
          poster_path: item.posterPath || '',
          backdrop_path: item.backdropPath,
          vote_average: item.rating ?? 0,
        },
      },
    });
  }

  isRemovingItem(contentId: string): boolean {
    return this.removingIds().has(contentId);
  }

  removeFromWatchlist(item: WatchlistItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isRemovingItem(item.contentId)) {
      return;
    }

    this.removingIds.update((current) => {
      const next = new Set(current);
      next.add(item.contentId);
      return next;
    });

    this.watchlistService.removeWatchlistItem(item.contentId).subscribe({
      next: () => {
        this.removingIds.update((current) => {
          const next = new Set(current);
          next.delete(item.contentId);
          return next;
        });
      },
      error: (err) => {
        this.removingIds.update((current) => {
          const next = new Set(current);
          next.delete(item.contentId);
          return next;
        });
        console.error('Error removing watchlist item:', err);
      },
    });
  }

  private normalizePlatform(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private matchesActivePill(item: WatchlistItem): boolean {
    const active = this.normalizePlatform(this.state.activePill());
    if (active === 'all') {
      return true;
    }

    const allowed = this.platformAliases[active] ?? [active];
    const platforms = [...(item.platforms ?? []), ...(item.whereToWatch ?? [])];

    return platforms.some((platform) => allowed.includes(this.normalizePlatform(platform)));
  }
}
