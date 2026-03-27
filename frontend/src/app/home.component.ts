import { Component, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { HeroComponent } from './components/hero.component';
import { ContentGridComponent } from './components/content-grid.component';
import {
  ContentItem,
  ContentService,
  DiscoverVibe,
  PagedContentResponse,
} from './services/content.service';
import { CommonModule } from '@angular/common';
import { StateService } from './services/state.service';
import { Observable } from 'rxjs';

const DEFAULT_VIBES: DiscoverVibe[] = [
  {
    id: 'cozy',
    name: 'Cozy',
    icon: 'coffee',
    color: '#f472b6',
    description: 'Warm and comforting content for relaxing',
    genres: [],
  },
  {
    id: 'intense',
    name: 'Intense',
    icon: 'zap',
    color: '#ef4444',
    description: 'Edge-of-your-seat thrills and action',
    genres: [],
  },
  {
    id: 'mindless',
    name: 'Mindless',
    icon: 'gamepad-2',
    color: '#fbbf24',
    description: 'Easy watching, no brainpower required',
    genres: [],
  },
  {
    id: 'thoughtful',
    name: 'Thoughtful',
    icon: 'lightbulb',
    color: '#3b82f6',
    description: 'Stimulating content that makes you think',
    genres: [],
  },
  {
    id: 'dark',
    name: 'Dark',
    icon: 'moon',
    color: '#8b5cf6',
    description: 'Moody, mysterious, and atmospheric',
    genres: [],
  },
  {
    id: 'funny',
    name: 'Funny',
    icon: 'smile',
    color: '#f97316',
    description: 'Guaranteed laughs and good times',
    genres: [],
  },
];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeroComponent, ContentGridComponent, CommonModule],
  template: `
    <div class="w-full pb-16">
      <app-hero></app-hero>

      <div>
        <app-content-grid
          title="Trending Movies This Week"
          [items]="trendingMovies()"
          [enableSlider]="true"
          [layout]="'rail'"
        ></app-content-grid>

        <app-content-grid
          title="Trending TV This Week"
          [items]="trendingShows()"
          [enableSlider]="true"
          [layout]="'rail'"
        ></app-content-grid>

        <app-content-grid
          title="Popular Movies"
          [items]="movies()"
          viewAllLink="/browse/movies"
          [enableSlider]="true"
          [layout]="'rail'"
        ></app-content-grid>

        <app-content-grid
          title="Popular Series"
          [items]="shows()"
          viewAllLink="/browse/tv"
          [enableSlider]="true"
          [layout]="'rail'"
        ></app-content-grid>

        <section class="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-5 lg:p-6">
          <p class="text-[11px] font-mono uppercase tracking-widest text-black/65 mb-2">
            Vibe-Based Discovery
          </p>
          <h2 class="text-2xl font-bold tracking-tight text-black mb-2">What are you in the mood for?</h2>
          <p class="text-sm text-black/65 mb-4">
            Pick a vibe to get movies and series matched to your current state.
          </p>

          <div class="flex flex-wrap gap-2.5">
            @for (vibe of availableVibes(); track vibe.id) {
              <button
                type="button"
                (click)="selectVibe(vibe.id)"
                class="rounded-full border px-4 py-2 text-[11px] font-mono uppercase tracking-widest transition-colors"
                [ngClass]="
                  selectedVibeId() === vibe.id
                    ? 'border-black bg-black text-white'
                    : 'border-black/15 text-black/70 hover:border-black/40 hover:text-black'
                "
              >
                {{ vibe.name }}
              </button>
            }
          </div>
        </section>

        <app-content-grid
          [title]="selectedVibeName() + ' Movies'"
          [items]="vibeMovies()"
          [enableSlider]="true"
          [layout]="'rail'"
        ></app-content-grid>

        <app-content-grid
          [title]="selectedVibeName() + ' Series'"
          [items]="vibeShows()"
          [enableSlider]="true"
          [layout]="'rail'"
        ></app-content-grid>

        <app-content-grid
          title="Movies Coming Next Month"
          [items]="upcomingMovies()"
          [enableSlider]="true"
          [layout]="'rail'"
        ></app-content-grid>

        <app-content-grid
          title="TV Premieres Next Month"
          [items]="upcomingShows()"
          [enableSlider]="true"
          [layout]="'rail'"
        ></app-content-grid>
      </div>
    </div>
  `,
})
export class HomeComponent {
  private contentService = inject(ContentService);
  private state = inject(StateService);
  private requestId = 0;
  private vibeRequestId = 0;

  availableVibes = signal<DiscoverVibe[]>(DEFAULT_VIBES);
  selectedVibeId = signal('cozy');
  vibeMovies = signal<ContentItem[]>([]);
  vibeShows = signal<ContentItem[]>([]);
  trendingMovies = signal<ContentItem[]>([]);
  trendingShows = signal<ContentItem[]>([]);
  upcomingMovies = signal<ContentItem[]>([]);
  upcomingShows = signal<ContentItem[]>([]);
  movies = signal<ContentItem[]>([]);
  shows = signal<ContentItem[]>([]);

  selectedVibeName = computed(
    () =>
      this.availableVibes().find((vibe) => vibe.id === this.selectedVibeId())?.name ||
      'Cozy',
  );

  constructor() {
    this.loadVibes();

    effect(() => {
      const providerId = this.state.selectedProviderId();
      const watchRegion = this.state.selectedWatchRegion();
      this.loadHomeRows(providerId, watchRegion);
    });

    effect(() => {
      const selectedVibe = this.selectedVibeId();
      const providerId = this.state.selectedProviderId();
      const watchRegion = this.state.selectedWatchRegion();
      this.loadVibeRows(selectedVibe, providerId, watchRegion);
    });
  }

  selectVibe(vibeId: string): void {
    if (vibeId === this.selectedVibeId()) return;
    this.selectedVibeId.set(vibeId);
  }

  private loadHomeRows(providerId: number | null, watchRegion: string): void {
    const currentRequest = ++this.requestId;

    // Reset current lists when provider changes before fetching page 1.
    this.trendingMovies.set([]);
    this.trendingShows.set([]);
    this.upcomingMovies.set([]);
    this.upcomingShows.set([]);
    this.movies.set([]);
    this.shows.set([]);

    this.loadRow(
      currentRequest,
      this.contentService.getTrendingPage('movie', 'week', 1, providerId, watchRegion),
      this.trendingMovies,
      'movie trending row',
    );
    this.loadRow(
      currentRequest,
      this.contentService.getTrendingPage('tv', 'week', 1, providerId, watchRegion),
      this.trendingShows,
      'tv trending row',
    );
    this.loadRow(
      currentRequest,
      this.contentService.getUpcomingMoviesPage(1, providerId, watchRegion),
      this.upcomingMovies,
      'upcoming movie row',
    );
    this.loadRow(
      currentRequest,
      this.contentService.getUpcomingTvShowsPage(1, providerId, watchRegion),
      this.upcomingShows,
      'upcoming tv row',
    );
    this.loadRow(
      currentRequest,
      this.contentService.getMoviesPage(1, providerId, watchRegion),
      this.movies,
      'movie row',
    );
    this.loadRow(
      currentRequest,
      this.contentService.getTvShowsPage(1, providerId, watchRegion),
      this.shows,
      'tv row',
    );
  }

  private loadRow(
    requestId: number,
    request$: Observable<PagedContentResponse>,
    target: WritableSignal<ContentItem[]>,
    rowLabel: string,
  ): void {
    request$.subscribe({
      next: (response) => {
        if (requestId !== this.requestId) return;
        target.set(response.results);
      },
      error: (error) => {
        if (requestId !== this.requestId) return;
        console.error(`Error loading ${rowLabel}:`, error);
      },
    });
  }

  private loadVibes(): void {
    this.contentService.getVibes().subscribe({
      next: (response) => {
        const predefinedVibes = response.vibes || DEFAULT_VIBES;
        this.availableVibes.set(predefinedVibes);

        const hasCurrentVibe = predefinedVibes.some((vibe) => vibe.id === this.selectedVibeId());
        if (!hasCurrentVibe && predefinedVibes.length > 0) {
          this.selectedVibeId.set(predefinedVibes[0].id);
        }
      },
      error: (error) => {
        console.error('Error loading predefined vibes:', error);
        this.availableVibes.set(DEFAULT_VIBES);
      },
    });
  }

  private loadVibeRows(vibeId: string, providerId: number | null, watchRegion: string): void {
    const currentRequest = ++this.vibeRequestId;

    this.vibeMovies.set([]);
    this.vibeShows.set([]);

    this.loadVibeRow(
      currentRequest,
      this.contentService.discoverByVibePage(vibeId, 'movie', 1, providerId, watchRegion),
      this.vibeMovies,
      'vibe movie row',
    );
    this.loadVibeRow(
      currentRequest,
      this.contentService.discoverByVibePage(vibeId, 'tv', 1, providerId, watchRegion),
      this.vibeShows,
      'vibe tv row',
    );
  }

  private loadVibeRow(
    requestId: number,
    request$: Observable<PagedContentResponse>,
    target: WritableSignal<ContentItem[]>,
    rowLabel: string,
  ): void {
    request$.subscribe({
      next: (response) => {
        if (requestId !== this.vibeRequestId) return;
        target.set(response.results);
      },
      error: (error) => {
        if (requestId !== this.vibeRequestId) return;
        console.error(`Error loading ${rowLabel}:`, error);
      },
    });
  }
}
