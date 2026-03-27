import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Router } from '@angular/router';
import { ContentItem } from '../services/content.service';
import { WatchlistService } from '../services/watchlist.service';

const PROVIDER_LABELS: Record<string, string> = {
  netflix: 'Netflix',
  prime: 'Prime Video',
  jiohotstar: 'JioHotstar',
  hbo: 'Max',
  hulu: 'Hulu',
  apple: 'Apple TV+',
  paramount: 'Paramount+',
  zee5: 'ZEE5',
  sonyliv: 'SonyLIV',
};

@Component({
  selector: 'app-show-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <article
      class="group"
      [ngClass]="mode === 'rail' ? 'w-[160px] sm:w-[176px] lg:w-[190px] shrink-0' : 'w-full'"
    >
      <div
        tabindex="0"
        (click)="openDetails()"
        (keydown.enter)="openDetails()"
        class="cursor-pointer outline-none"
      >
        <div
          class="st-card relative aspect-[2/3] overflow-hidden border border-black/10 bg-white shadow-sm transition-transform duration-300 group-hover:-translate-y-1"
        >
          <img
            [src]="watchlistService.getImageUrl(item.poster_path)"
            [alt]="displayTitle()"
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />

          <span
            class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-black/70 px-2 py-1 text-[10px] font-semibold text-white font-mono"
          >
            <lucide-icon name="star" class="h-3 w-3 fill-white"></lucide-icon>
            {{ rating() }}
          </span>

          <button
            type="button"
            (click)="addToWatchlist($event)"
            [disabled]="isAdding() || isAdded()"
            class="absolute right-2 top-2 flex h-8 w-8 items-center justify-center overflow-hidden rounded-[var(--radius-pill)] border border-black/10 bg-white text-black shadow-sm transition-colors disabled:cursor-not-allowed"
            [ngClass]="
              isAdded()
                ? 'bg-black text-white border-black'
                : 'hover:bg-black hover:text-white'
            "
          >
            @if (showTickPulse()) {
              <span class="absolute inset-0 animate-ping bg-black/25"></span>
            }

            @if (isAdding()) {
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            } @else if (isAdded()) {
              <lucide-icon name="check" class="h-4 w-4"></lucide-icon>
            } @else {
              <lucide-icon name="plus" class="h-4 w-4"></lucide-icon>
            }
          </button>
        </div>

        <div class="mt-3 space-y-2 px-0.5">
          <h3 class="truncate text-[14px] font-semibold leading-tight text-black">
            {{ displayTitle() }}
          </h3>

          <div
            class="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-black/55"
          >
            <span>{{ year() || 'N/A' }}</span>
            <span>{{ item.type === 'movie' ? 'Movie' : 'Series' }}</span>
          </div>

          <div class="flex flex-wrap gap-1.5">
            @for (provider of providerBadges(); track provider) {
              <span
                class="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-[10px] font-medium text-black/65"
              >
                {{ provider }}
              </span>
            }
          </div>
        </div>
      </div>
    </article>
  `,
})
export class ShowCardComponent {
  @Input({ required: true }) item!: ContentItem;
  @Input() mode: 'rail' | 'grid' = 'rail';

  private router = inject(Router);
  watchlistService = inject(WatchlistService);
  isAdding = signal(false);
  isAdded = signal(false);
  showTickPulse = signal(false);

  displayTitle(): string {
    return this.item.title || this.item.name || 'Untitled';
  }

  year(): string {
    return (this.item.release_date || this.item.first_air_date || '').split('-')[0] || '';
  }

  rating(): string {
    return Number.isFinite(this.item.vote_average) ? this.item.vote_average.toFixed(1) : '0.0';
  }

  providerBadges(): string[] {
    const providers = this.item.watchProviders ?? [];
    if (providers.length === 0) {
      return ['OTT Info Soon'];
    }

    return providers.slice(0, 3).map((provider) => PROVIDER_LABELS[provider] || provider);
  }

  openDetails(): void {
    const tmdbId = this.resolveTmdbId(this.item);
    if (!tmdbId) {
      return;
    }

    const route = this.item.type === 'movie' ? '/movie' : '/tv';
    void this.router.navigate([route, tmdbId], {
      state: {
        preview: this.item,
      },
    });
  }

  addToWatchlist(event: Event): void {
    event.stopPropagation();

    if (this.isAdding() || this.isAdded()) {
      return;
    }

    const contentId = this.toContentId(this.item);
    this.isAdding.set(true);

    this.watchlistService
      .addWatchlistItem({
        contentId,
        title: this.displayTitle(),
        type: this.item.type,
        posterPath: this.item.poster_path,
        backdropPath: this.item.backdrop_path,
        status: 'want',
      })
      .subscribe({
        next: () => {
          this.isAdding.set(false);
          this.markAddedWithTick();
        },
        error: (error) => {
          this.isAdding.set(false);

          if (this.isAlreadyAddedError(error)) {
            this.markAddedWithTick();
            return;
          }

          console.error('Error adding to watchlist:', error);
        },
      });
  }

  private markAddedWithTick(): void {
    this.isAdded.set(true);
    this.showTickPulse.set(true);
    setTimeout(() => this.showTickPulse.set(false), 450);
  }

  private toContentId(item: ContentItem): string {
    const rawId = String(item.id);
    return rawId.includes('-') ? rawId : `${item.type}-${rawId}`;
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
}
