import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ContentItem, ContentService } from '../services/content.service';
import { WatchlistService } from '../services/watchlist.service';

interface ProviderUi {
  id: string;
  label: string;
  colorClass: string;
}

const PROVIDER_UI: Record<string, ProviderUi> = {
  netflix: { id: 'netflix', label: 'Netflix', colorClass: 'bg-[#e2e2e7] text-[#1d1d1f]' },
  prime: { id: 'prime', label: 'Prime Video', colorClass: 'bg-[#e2e2e7] text-[#1d1d1f]' },
  jiohotstar: { id: 'jiohotstar', label: 'JioHotstar', colorClass: 'bg-[#e2e2e7] text-[#1d1d1f]' },
  hbo: { id: 'hbo', label: 'Max', colorClass: 'bg-[#e2e2e7] text-[#1d1d1f]' },
  hulu: { id: 'hulu', label: 'Hulu', colorClass: 'bg-[#e2e2e7] text-[#1d1d1f]' },
  apple: { id: 'apple', label: 'Apple TV+', colorClass: 'bg-[#e2e2e7] text-[#1d1d1f]' },
  paramount: { id: 'paramount', label: 'Paramount+', colorClass: 'bg-[#e2e2e7] text-[#1d1d1f]' },
  zee5: { id: 'zee5', label: 'ZEE5', colorClass: 'bg-[#e2e2e7] text-[#1d1d1f]' },
  sonyliv: { id: 'sonyliv', label: 'SonyLIV', colorClass: 'bg-[#e2e2e7] text-[#1d1d1f]' },
};

@Component({
  selector: 'app-content-details-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    @if (item) {
      <div
        class="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        (click)="close()"
      >
        <article
          class="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          @if (isLoading()) {
            <div class="flex items-center justify-center py-20">
              <div class="flex flex-col items-center gap-4">
                <div class="animate-spin rounded-full h-8 w-8 border-4 border-[#1d1d1f] border-t-transparent"></div>
                <span class="text-xs font-mono uppercase tracking-widest text-black/50">Loading...</span>
              </div>
            </div>
          } @else if (errorMessage()) {
            <div class="flex flex-col items-center justify-center py-20 px-6 text-center">
              <lucide-icon name="alert-circle" class="h-10 w-10 text-black/30 mb-4"></lucide-icon>
              <p class="text-sm text-black/60 mb-2">{{ errorMessage() }}</p>
              <button
                (click)="close()"
                class="mt-4 text-xs font-mono uppercase tracking-widest text-black/50 hover:text-black transition-colors"
              >
                Close
              </button>
            </div>
          } @else if (content(); as detail) {
            <div class="relative">
              <button
                (click)="close()"
                class="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/10 text-black/70 transition-all hover:bg-black hover:text-white"
              >
                <lucide-icon name="x" class="h-4 w-4"></lucide-icon>
              </button>

              <div class="flex flex-col sm:flex-row">
                <div class="relative sm:w-[200px] flex-shrink-0">
                  <img
                    [src]="watchlistService.getImageUrl(detail.poster_path)"
                    [alt]="detail.title || detail.name"
                    class="w-full sm:w-[200px] aspect-[2/3] object-cover"
                  />
                </div>

                <div class="flex-1 p-6 sm:p-8">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-2.5 py-1 text-[11px] font-semibold text-white font-mono">
                      <lucide-icon name="star" class="h-3 w-3 fill-white"></lucide-icon>
                      {{ (detail.vote_average || 0).toFixed(1) }}
                    </span>
                    <span class="text-[10px] font-mono uppercase tracking-widest text-black/50">
                      {{ detail.type === 'movie' ? 'Movie' : 'Series' }}
                    </span>
                    @if (releaseYear()) {
                      <span class="text-[10px] font-mono uppercase tracking-widest text-black/50">
                        · {{ releaseYear() }}
                      </span>
                    }
                  </div>

                  <h2 class="text-2xl sm:text-3xl font-bold tracking-tight text-black mb-4">
                    {{ detail.title || detail.name }}
                  </h2>

                  <p class="text-sm leading-relaxed text-black/70 mb-6">
                    {{ shortOverview(detail.overview) }}
                  </p>

                  <div class="mb-6">
                    <h4 class="text-[10px] font-mono uppercase tracking-widest text-black/40 mb-3">
                      Available On
                    </h4>
                    <div class="flex flex-wrap gap-2">
                      @for (provider of providers(); track provider.id) {
                        <span
                          class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                          [ngClass]="provider.colorClass"
                        >
                          {{ provider.label }}
                        </span>
                      }
                      @if (providers().length === 0) {
                        <span class="text-xs text-black/40 italic">
                          No streaming info available
                        </span>
                      }
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    <button
                      (click)="addToWatchlist()"
                      [disabled]="isAddingToWatchlist() || isInWatchlist()"
                      class="inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-mono uppercase tracking-widest transition-all duration-200 disabled:cursor-not-allowed"
                      [ngClass]="isInWatchlist() 
                        ? 'bg-[#1d1d1f] text-white' 
                        : 'bg-black text-white hover:bg-black/80'"
                    >
                      @if (isAddingToWatchlist()) {
                        <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Adding...
                      } @else if (isInWatchlist()) {
                        <lucide-icon name="check" class="h-4 w-4"></lucide-icon>
                        Added
                      } @else {
                        <lucide-icon name="plus" class="h-4 w-4"></lucide-icon>
                        Add to Watchlist
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }
        </article>
      </div>
    }
  `,
})
export class ContentDetailsModalComponent implements OnChanges, OnDestroy {
  @Input() item: ContentItem | null = null;
  @Output() closed = new EventEmitter<void>();

  private contentService = inject(ContentService);
  watchlistService = inject(WatchlistService);

  content = signal<ContentItem | null>(null);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  isAddingToWatchlist = signal(false);
  isInWatchlist = signal(false);

  private previousBodyOverflow = '';
  private bodyLocked = false;

  releaseYear = computed(() => {
    const detail = this.content();
    const date = detail?.release_date || detail?.first_air_date || '';
    return date.split('-')[0] || '';
  });

  providers = computed(() => {
    const providerIds = this.content()?.watchProviders ?? [];
    const unique = Array.from(new Set(providerIds));

    return unique.map((providerId) => {
      const mapped = PROVIDER_UI[providerId];
      if (mapped) return mapped;
      return {
        id: providerId,
        label: providerId,
        colorClass: 'bg-[#e2e2e7] text-[#1d1d1f]',
      };
    });
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (!('item' in changes)) return;

    const current = this.item;
    if (!current) {
      this.content.set(null);
      this.errorMessage.set(null);
      this.isLoading.set(false);
      this.isAddingToWatchlist.set(false);
      this.isInWatchlist.set(false);
      this.lockBodyScroll(false);
      return;
    }

    this.lockBodyScroll(true);
    this.isAddingToWatchlist.set(false);
    this.isInWatchlist.set(false);
    void this.loadDetails(current);
  }

  ngOnDestroy(): void {
    this.lockBodyScroll(false);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.item) this.close();
  }

  close(): void {
    this.lockBodyScroll(false);
    this.closed.emit();
  }

  shortOverview(text?: string): string {
    const value = (text || '').trim();
    if (!value) return 'No overview available.';
    if (value.length <= 300) return value;
    return `${value.slice(0, 297)}...`;
  }

  addToWatchlist(): void {
    const detail = this.content();
    if (!detail || this.isAddingToWatchlist() || this.isInWatchlist()) return;

    this.isAddingToWatchlist.set(true);
    const rawId = String(detail.id);
    const contentId = rawId.includes('-') ? rawId : `${detail.type}-${rawId}`;

    this.watchlistService
      .addWatchlistItem({
        contentId,
        title: detail.title || detail.name || 'Unknown',
        type: detail.type,
        posterPath: detail.poster_path,
        backdropPath: detail.backdrop_path,
        genre: detail.genres?.join(' / '),
        status: 'want',
      })
      .subscribe({
        next: () => {
          this.isAddingToWatchlist.set(false);
          this.isInWatchlist.set(true);
        },
        error: (error) => {
          this.isAddingToWatchlist.set(false);
          if (this.isAlreadyAddedError(error)) {
            this.isInWatchlist.set(true);
            return;
          }
          console.error('Error adding to watchlist:', error);
        },
      });
  }

  private isAlreadyAddedError(error: unknown): boolean {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : undefined;
    const message = [
      error instanceof Error ? error.message : '',
      (error as { error?: { error?: string } })?.error?.error || '',
    ]
      .join(' ')
      .toLowerCase();
    return status === 409 || message.includes('already in watchlist') || message.includes('already added');
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

  private async loadDetails(item: ContentItem): Promise<void> {
    const tmdbId = this.resolveTmdbId(item);
    if (!tmdbId) {
      this.content.set(item);
      this.errorMessage.set('Detailed data is unavailable for this title.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const detail = await firstValueFrom(this.contentService.getDetails(item.type, tmdbId));
      this.content.set(detail);
    } catch (error) {
      console.error('Error loading modal details:', error);
      this.content.set(item);
      this.errorMessage.set('Could not load full details right now.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private lockBodyScroll(shouldLock: boolean): void {
    if (typeof window === 'undefined') return;

    if (shouldLock && !this.bodyLocked) {
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.bodyLocked = true;
      return;
    }

    if (!shouldLock && this.bodyLocked) {
      document.body.style.overflow = this.previousBodyOverflow;
      this.bodyLocked = false;
    }
  }
}
