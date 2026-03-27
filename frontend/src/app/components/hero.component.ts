import { Component, signal, HostListener, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Router } from '@angular/router';
import { ContentService, ContentItem } from '../services/content.service';
import { WatchlistService } from '../services/watchlist.service';
import { OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <section
      class="relative mb-[84px] min-h-[520px] overflow-hidden border border-black/10 bg-[var(--surface-gradient-tonight)]"
      style="border-radius: var(--radius-card);"
    >
      <div class="relative z-10 mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-10 px-[10%] py-16 md:grid-cols-2">
        <!-- Left Content -->
        <div class="reveal delay-1">
          <div class="mb-7 font-mono text-[10px] uppercase tracking-[5px] text-black/45">
            TONIGHT'S PICK
          </div>

          <h1
            class="mb-7 text-5xl font-extrabold leading-[1.02] tracking-[-1.2px] text-black transition-all duration-500 md:text-[4.8rem]"
            [ngClass]="{ 'opacity-0 translate-y-4': isLoading() }"
            [innerHTML]="formatTitle(pick()?.title || pick()?.name || '')"
          >
          </h1>

          <div
            class="mb-10 flex flex-wrap items-center gap-2.5 font-mono text-[11px] tracking-widest transition-all delay-100 duration-500"
            [ngClass]="{ 'opacity-0 translate-y-4': isLoading() }"
          >
            <span class="st-pill-meta">{{ pick()?.type === 'movie' ? 'Movie' : 'TV Series' }}</span>
            <span class="st-pill-meta">{{ (pick()?.release_date || pick()?.first_air_date || '').split('-')[0] }}</span>
            <span class="st-pill-meta flex items-center gap-1.5">
              <lucide-icon name="star" class="h-3.5 w-3.5 fill-white"></lucide-icon>
              Rating {{ (pick()?.vote_average || 0).toFixed(1) }}
            </span>
            @if (slotLabel()) {
              <span class="st-pill-meta">{{ slotLabel() }}</span>
            }
            @if (vibeLabel()) {
              <span class="st-pill-meta">{{ vibeLabel() }}</span>
            }
          </div>

          <p
            class="mb-8 max-w-[560px] text-sm text-black/70"
            [ngClass]="{ 'opacity-0 translate-y-4': isLoading() }"
          >
            {{ tonightReason() }}
          </p>

          <div class="flex flex-wrap gap-4">
            <button
              type="button"
              (click)="openPickDetails()"
              class="st-pill border border-black/15 bg-white font-mono text-[10px] font-bold uppercase tracking-[2px] text-black transition-all duration-300 hover:bg-black hover:text-white"
            >
              VIEW DETAILS
            </button>

            <button
              (click)="togglePickWatchlist()"
              [disabled]="isAddingToWatchlist() || isRemovingFromWatchlist()"
              class="st-pill relative overflow-hidden border-none font-mono text-[10px] font-bold uppercase tracking-[2px] transition-all duration-300 disabled:cursor-not-allowed"
              [ngClass]="
                isPickAdded()
                  ? 'bg-white text-black border border-black/20 hover:bg-black hover:text-white'
                  : 'bg-black text-white hover:bg-black/80'
              "
            >
              @if (showTickPulse()) {
                <span class="absolute inset-0 animate-ping bg-black/25"></span>
              }

              <span class="relative flex items-center gap-3">
                @if (isAddingToWatchlist()) {
                  <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ADDING...
                } @else if (isRemovingFromWatchlist()) {
                  <div class="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                  REMOVING...
                } @else if (isPickAdded()) {
                  <lucide-icon name="trash-2" class="w-4 h-4"></lucide-icon>
                  REMOVE FROM WATCHLIST
                } @else {
                  <lucide-icon name="plus" class="w-4 h-4"></lucide-icon>
                  ADD TO WATCHLIST
                }
              </span>
            </button>
          </div>

          @if (tonightOptions().length > 1) {
            <div class="mt-7">
              <div class="mb-2 flex items-center justify-between gap-3">
                <p class="text-[10px] font-mono uppercase tracking-[3px] text-black/45">
                  More Tonight Options
                </p>

                @if (showOptionsSliderControls()) {
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      (click)="scrollOptions(-1)"
                      [disabled]="!canScrollOptionsPrev"
                      class="h-7 w-7 rounded-full border border-black/15 text-black/80 transition-colors enabled:hover:bg-black enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Scroll tonight options left"
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      (click)="scrollOptions(1)"
                      [disabled]="!canScrollOptionsNext"
                      class="h-7 w-7 rounded-full border border-black/15 text-black/80 transition-colors enabled:hover:bg-black enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Scroll tonight options right"
                    >
                      &gt;
                    </button>
                  </div>
                }
              </div>

              <div
                #optionsScroller
                (scroll)="onOptionsScroll()"
                class="no-scrollbar flex gap-2 overflow-x-auto scroll-smooth pb-1"
              >
                @for (option of tonightOptions(); track optionTrackId(option)) {
                  <button
                    type="button"
                    (click)="switchOption(option)"
                    class="shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors"
                    [ngClass]="
                      isOptionSelected(option)
                        ? 'border-black bg-black text-white'
                        : 'border-black/15 bg-white text-black/80 hover:border-black/35'
                    "
                  >
                    {{ optionTitle(option) }}
                  </button>
                }
              </div>
            </div>
          }
        </div>

        <div
          (click)="openPickDetails()"
          (keydown.enter)="openPickDetails()"
          tabindex="0"
          class="group relative mr-0 cursor-pointer justify-self-center reveal delay-2 md:justify-self-end"
        >
          <div
            #visual
            class="st-poster-rounded st-poster-elevated relative h-[480px] w-[320px] overflow-hidden border border-black/10 transition-all duration-1000 ease-out"
            [ngClass]="{ 'animate-pulse bg-black/5': isLoading() }"
          >
            <img
              [src]="watchlistService.getImageUrl(pick()?.poster_path)"
              [alt]="pick()?.title"
              class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        </div>
      </div>
    </section>
  `,
})
export class HeroComponent implements OnInit, OnDestroy {
  private contentService = inject(ContentService);
  private router = inject(Router);
  watchlistService = inject(WatchlistService);

  pick = signal<ContentItem | null>(null);
  tonightOptions = signal<ContentItem[]>([]);
  tonightReason = signal('');
  slotLabel = signal('');
  vibeLabel = signal('');
  isLoading = signal(true);
  isAddingToWatchlist = signal(false);
  isRemovingFromWatchlist = signal(false);
  isPickAdded = signal(false);
  showTickPulse = signal(false);
  @ViewChild('visual') visualRef!: ElementRef<HTMLDivElement>;
  @ViewChild('optionsScroller') optionsScrollerRef?: ElementRef<HTMLDivElement>;

  canScrollOptionsPrev = false;
  canScrollOptionsNext = false;

  private watchlistSub?: Subscription;
  private watchlistIds = new Set<string>();

  ngOnInit() {
    this.isLoading.set(true);

    this.watchlistSub = this.watchlistService.getWatchlist().subscribe((items) => {
      this.watchlistIds = new Set(items.map((item) => item.contentId));
      this.syncPickWatchlistState();
    });

    this.contentService.getTonightPick().subscribe({
      next: (data) => {
        if (!data.pick) {
          this.loadFallbackTrending();
          return;
        }
        this.pick.set(data.pick);
        this.tonightOptions.set(this.buildUniqueOptions(data.options || [], data.pick));
        this.syncOptionsScrollState();
        this.tonightReason.set(data.reason || 'A top-rated pick for you right now.');
        this.slotLabel.set(this.formatSlotLabel(data.slot));
        this.vibeLabel.set(data.vibeName || '');
        this.syncPickWatchlistState();
        this.isLoading.set(false);
        this.isAddingToWatchlist.set(false);
        this.isRemovingFromWatchlist.set(false);
        this.showTickPulse.set(false);
      },
      error: () => {
        this.loadFallbackTrending();
      },
    });
  }

  private loadFallbackTrending() {
    this.contentService.getTrending('all', 'week').subscribe({
      next: (items) => {
        if (items.length > 0) {
          const randomIndex = Math.floor(Math.random() * Math.min(items.length, 5));
          this.pick.set(items[randomIndex]);
          this.tonightOptions.set(this.buildUniqueOptions(items.slice(0, 8), items[randomIndex]));
          this.syncOptionsScrollState();
          this.tonightReason.set('Fallback pick from this week\'s trending titles.');
          this.slotLabel.set('');
          this.vibeLabel.set('');
          this.syncPickWatchlistState();
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching fallback trending:', err);
        this.isLoading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.watchlistSub?.unsubscribe();
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

  private markAddedWithTick(): void {
    this.isPickAdded.set(true);
    this.showTickPulse.set(true);
    setTimeout(() => this.showTickPulse.set(false), 450);
  }

  private markRemovedWithTick(): void {
    this.isPickAdded.set(false);
    this.showTickPulse.set(true);
    setTimeout(() => this.showTickPulse.set(false), 450);
  }

  togglePickWatchlist(): void {
    if (this.isPickAdded()) {
      this.removePickFromWatchlist();
      return;
    }

    this.addPickToWatchlist();
  }

  addPickToWatchlist() {
    const item = this.pick();
    if (!item || this.isAddingToWatchlist() || this.isRemovingFromWatchlist() || this.isPickAdded()) return;

    const contentId = this.toContentId(item);
    this.isAddingToWatchlist.set(true);

    this.watchlistService
      .addWatchlistItem({
        contentId,
        title: item.title || item.name || 'Unknown',
        type: item.type,
        posterPath: item.poster_path,
        backdropPath: item.backdrop_path,
        status: 'want',
      })
      .subscribe({
        next: () => {
          this.isAddingToWatchlist.set(false);
          this.markAddedWithTick();
        },
        error: (err) => {
          this.isAddingToWatchlist.set(false);

          if (this.isAlreadyAddedError(err)) {
            this.markAddedWithTick();
            return;
          }

          console.error('Error adding tonight pick:', err);
        },
      });
  }

  removePickFromWatchlist(): void {
    const item = this.pick();
    if (!item || this.isRemovingFromWatchlist() || this.isAddingToWatchlist() || !this.isPickAdded()) {
      return;
    }

    this.isRemovingFromWatchlist.set(true);
    const contentId = this.toContentId(item);

    this.watchlistService.removeWatchlistItem(contentId).subscribe({
      next: () => {
        this.isRemovingFromWatchlist.set(false);
        this.markRemovedWithTick();
      },
      error: (err) => {
        this.isRemovingFromWatchlist.set(false);
        console.error('Error removing tonight pick:', err);
      },
    });
  }

  openPickDetails(): void {
    const item = this.pick();
    if (!item) {
      return;
    }

    const tmdbId = this.resolveTmdbId(item);
    if (!tmdbId) return;

    const route = item.type === 'movie' ? '/movie' : '/tv';
    void this.router.navigate([route, tmdbId], {
      state: {
        preview: item,
      },
    });
  }

  formatTitle(title: string): string {
    if (!title) return '';
    const words = title.split(' ');
    if (words.length > 2) {
      return words.slice(0, 2).join(' ') + '<br />' + words.slice(2).join(' ');
    }
    return title;
  }

  switchOption(item: ContentItem): void {
    const current = this.pick();
    if (!item || (current && this.optionTrackId(current) === this.optionTrackId(item))) {
      return;
    }

    this.pick.set(item);
    this.syncPickWatchlistState();
    this.isAddingToWatchlist.set(false);
    this.isRemovingFromWatchlist.set(false);
    this.showTickPulse.set(false);
  }

  optionTrackId(item: ContentItem): string {
    if (typeof item.tmdbId === 'number') {
      return `${item.type}-${item.tmdbId}`;
    }

    return `${item.type}-${item.id}`;
  }

  optionTitle(item: ContentItem): string {
    return item.title || item.name || 'Untitled';
  }

  isOptionSelected(item: ContentItem): boolean {
    const current = this.pick();
    if (!current) return false;

    return this.optionTrackId(current) === this.optionTrackId(item);
  }

  showOptionsSliderControls(): boolean {
    return this.tonightOptions().length > 1;
  }

  onOptionsScroll(): void {
    this.updateOptionsScrollState();
  }

  scrollOptions(direction: -1 | 1): void {
    const scroller = this.optionsScrollerRef?.nativeElement;
    if (!scroller) {
      return;
    }

    const delta = Math.max(220, Math.floor(scroller.clientWidth * 0.8));
    scroller.scrollBy({ left: delta * direction, behavior: 'smooth' });
    setTimeout(() => this.updateOptionsScrollState(), 280);
  }

  private resolveTmdbId(item: ContentItem): number | null {
    if (typeof item.tmdbId === 'number' && Number.isInteger(item.tmdbId) && item.tmdbId > 0) {
      return item.tmdbId;
    }

    if (typeof item.id === 'number' && Number.isInteger(item.id) && item.id > 0) {
      return item.id;
    }

    if (typeof item.id === 'string') {
      const parts = item.id.split('-');
      const candidate = Number(parts[parts.length - 1]);
      if (Number.isInteger(candidate) && candidate > 0) return candidate;
    }

    return null;
  }

  private formatSlotLabel(slot?: 'morning' | 'evening' | 'night'): string {
    if (!slot) return '';
    if (slot === 'morning') return 'Morning Slot';
    if (slot === 'evening') return 'Evening Slot';
    return 'Night Slot';
  }

  private buildUniqueOptions(items: ContentItem[], preferred?: ContentItem | null): ContentItem[] {
    const deduped = new Map<string, ContentItem>();

    if (preferred) {
      deduped.set(this.optionTrackId(preferred), preferred);
    }

    items.forEach((item) => {
      deduped.set(this.optionTrackId(item), item);
    });

    return Array.from(deduped.values()).slice(0, 8);
  }

  private syncOptionsScrollState(): void {
    setTimeout(() => this.updateOptionsScrollState(), 0);
  }

  private updateOptionsScrollState(): void {
    const scroller = this.optionsScrollerRef?.nativeElement;
    if (!scroller) {
      this.canScrollOptionsPrev = false;
      this.canScrollOptionsNext = false;
      return;
    }

    const epsilon = 2;
    this.canScrollOptionsPrev = scroller.scrollLeft > epsilon;
    this.canScrollOptionsNext =
      scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - epsilon;
  }

  private toContentId(item: ContentItem): string {
    const rawId = String(item.id);
    return rawId.includes('-') ? rawId : `${item.type}-${rawId}`;
  }

  private syncPickWatchlistState(): void {
    const current = this.pick();
    if (!current) {
      this.isPickAdded.set(false);
      return;
    }

    this.isPickAdded.set(this.watchlistIds.has(this.toContentId(current)));
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.visualRef) return;
    const visual = this.visualRef.nativeElement;
    const { left, top, width, height } = visual.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    visual.style.transform = `perspective(1000px) rotateY(${x * 4}deg) rotateX(${y * -4}deg) scale(1.02)`;
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    if (!this.visualRef) return;
    this.visualRef.nativeElement.style.transform = `perspective(1000px) rotateY(0) rotateX(0) scale(1)`;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateOptionsScrollState();
  }
}
