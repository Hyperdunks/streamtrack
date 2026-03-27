import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  ViewChildren,
  QueryList,
  effect,
  AfterViewInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { StateService } from '../services/state.service';
import { WatchlistService } from '../services/watchlist.service';

const PROVIDER_TO_TMDB_ID: Record<string, number | null> = {
  All: null,
  Netflix: 8,
  'Prime Video': 9,
  JioHotstar: 337,
  Zee5: 232,
  ZEE5: 232,
  SonyLIV: 237,
};

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  template: `
    <header class="fixed inset-x-0 top-0 z-50 flex h-[72px] w-full items-center justify-between border-b border-[#e7e7e7] bg-white px-[4%] font-sans">
      <!-- Group 1: Logo -->
      <a routerLink="/home" class="flex items-center gap-2 text-lg font-bold tracking-tight text-[#1a1a1a] no-underline">
        <span class="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a]">
          <span class="h-1.5 w-1.5 rounded-full bg-white"></span>
        </span>
        StreamTrack
      </a>

      @if (!isAuthPage()) {
        <div class="hidden flex-1 items-center justify-center gap-4 lg:flex">
          <!-- Group 2: Nav -->
          <nav class="relative flex h-[44px] items-center rounded-[50px] border border-[#e0e0e0] bg-[#f5f5f5] p-[4px]">
            <div class="absolute inset-y-[4px] z-0 rounded-[50px] bg-black transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]"
                 [style.left.px]="navIndicatorLeft()"
                 [style.width.px]="navIndicatorWidth()"></div>
            <a #navButton routerLink="/home" (click)="setActiveNav('/home')"
               class="relative z-10 flex h-[36px] items-center justify-center rounded-[50px] px-4 text-[14px] font-[500] tracking-tight no-underline transition-colors"
               [ngClass]="activeNavPath() === '/home' ? 'text-white' : 'text-[#6f6f6f] hover:text-[#1a1a1a]'">
              Home
            </a>
            <a #navButton routerLink="/watchlist" (click)="setActiveNav('/watchlist')"
               class="relative z-10 flex h-[36px] items-center justify-center rounded-[50px] px-4 text-[14px] font-[500] tracking-tight no-underline transition-colors"
               [ngClass]="activeNavPath() === '/watchlist' ? 'text-white' : 'text-[#6f6f6f] hover:text-[#1a1a1a]'">
              Watchlist
            </a>
          </nav>

          <!-- Group 3: Search -->
          <label class="flex h-[44px] items-center overflow-hidden rounded-[50px] border border-[#e0e0e0] bg-[#f5f5f5] transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] focus-within:border-black/20"
                 [ngClass]="isSearchExpanded() ? 'w-[250px] px-4 gap-2.5' : 'w-[44px] px-0 justify-center cursor-pointer'"
                 (click)="!isSearchExpanded() && toggleSearch($event)">
            <lucide-icon name="search" class="h-4 w-4 text-[#1a1a1a] opacity-60 flex-shrink-0"></lucide-icon>
            <input type="text" #searchInput [ngModel]="state.searchQuery()" (ngModelChange)="onSearchChange($event)"
                   (blur)="closeSearch()"
                   placeholder="Search titles"
                   class="h-full border-none bg-transparent text-[14px] font-[400] text-[#1a1a1a] outline-none placeholder:text-[#6f6f6f] transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]"
                   [ngClass]="isSearchExpanded() ? 'w-full opacity-100' : 'w-0 opacity-0 pointer-events-none'" />
          </label>

          <!-- Group 4: Providers -->
          <div class="relative flex h-[44px] items-center rounded-[50px] border border-[#e0e0e0] bg-[#f5f5f5] p-[4px] gap-1">
            <div class="absolute inset-y-[4px] z-0 rounded-[50px] bg-black transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]"
                 [style.left.px]="pillIndicatorLeft()"
                 [style.width.px]="pillIndicatorWidth()"></div>
            @for (pill of pills; track pill) {
              <button #pillButton type="button" (click)="setActivePill(pill)"
                      class="relative z-10 flex h-[36px] items-center justify-center rounded-[50px] px-4 text-[12px] font-[600] uppercase tracking-[0.05em] transition-colors"
                      [ngClass]="state.activePill() === pill ? 'text-white' : 'text-[#6f6f6f] hover:text-[#1a1a1a]'">
                {{ pill }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Group 5: Action/Auth -->
      <div class="flex items-center gap-2.5">

        @if (auth.isAuthenticated() && !isAuthPage()) {
          <a routerLink="/profile"
             class="hidden h-[44px] items-center justify-center rounded-[50px] border border-[#e0e0e0] bg-white px-6 text-[12px] font-[600] uppercase tracking-[0.05em] text-[#1a1a1a] no-underline transition-colors hover:bg-[#f5f5f5] md:flex">
            PROFILE
          </a>
          <button type="button" (click)="logout()"
                  class="hidden h-[44px] items-center justify-center rounded-[50px] border border-black bg-black px-6 text-[12px] font-[600] uppercase tracking-[0.05em] text-white transition-opacity hover:opacity-90 md:flex">
            LOGOUT
          </button>
        } @else if (!auth.isAuthenticated()) {
          @if (!isLoginPage()) {
            <a routerLink="/login"
               class="hidden h-[44px] items-center justify-center rounded-[50px] border border-[#e0e0e0] bg-white px-6 text-[12px] font-[600] uppercase tracking-[0.05em] text-[#1a1a1a] no-underline transition-colors hover:bg-[#f5f5f5] md:flex">
              LOGIN
            </a>
          }
          @if (!isSignupPage()) {
            <a routerLink="/signup"
               class="hidden h-[44px] items-center justify-center rounded-[50px] border border-black bg-black px-6 text-[12px] font-[600] uppercase tracking-[0.05em] text-white no-underline transition-opacity hover:opacity-90 md:flex">
              SIGN UP
            </a>
          }
        }

        @if (!isAuthPage()) {
          <button type="button" (click)="toggleMobileMenu()"
                  class="flex h-[44px] w-[44px] items-center justify-center rounded-[50px] border border-[#e0e0e0] bg-[#f5f5f5] text-[#1a1a1a] lg:hidden">
            <lucide-icon [name]="mobileMenuOpen() ? 'x' : 'align-justify'" class="h-5 w-5"></lucide-icon>
          </button>
        }
      </div>
    </header>

    <!-- Mobile Menu -->
    @if (mobileMenuOpen() && !isAuthPage()) {
      <div class="border-t border-[#e7e7e7] bg-[#f8f8f8] lg:hidden">
        <div class="space-y-4 px-[4%] py-4">
          <nav class="flex flex-col gap-3">
            <a routerLink="/home" (click)="closeMobileMenu()"
               class="inline-flex h-[44px] items-center rounded-[50px] border border-[#dddddd] bg-white px-6 text-[14px] font-[500] text-[#1a1a1a] no-underline">
               Home
            </a>
            <a routerLink="/watchlist" (click)="closeMobileMenu()"
               class="inline-flex h-[44px] items-center rounded-[50px] border border-[#dddddd] bg-white px-6 text-[14px] font-[500] text-[#1a1a1a] no-underline">
               Watchlist
            </a>
          </nav>

          <label class="inline-flex h-[44px] w-full items-center gap-2.5 rounded-[50px] border border-[#dddddd] bg-white px-4">
            <lucide-icon name="search" class="h-4 w-4 text-[#1a1a1a] opacity-60"></lucide-icon>
            <input type="text" [ngModel]="state.searchQuery()" (ngModelChange)="onSearchChange($event)"
                   placeholder="Search titles"
                   class="h-full w-full border-none bg-transparent text-[14px] font-[400] text-[#1a1a1a] outline-none placeholder:text-[#6f6f6f]" />
          </label>

          <div class="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            @for (pill of pills; track pill) {
              <button type="button" (click)="setActivePill(pill)"
                      class="h-[44px] whitespace-nowrap rounded-[50px] border border-[#dddddd] bg-white px-6 text-[12px] font-[600] uppercase tracking-[0.05em] text-[#1a1a1a]"
                      [ngClass]="state.activePill() === pill ? 'border-black bg-black text-white' : ''">
                {{ pill }}
              </button>
            }
          </div>

          @if (auth.isAuthenticated()) {
            <div class="flex items-center gap-3">
              <a routerLink="/profile" (click)="closeMobileMenu()"
                 class="inline-flex h-[44px] items-center rounded-[50px] border border-[#dddddd] bg-white px-6 text-[12px] font-[600] uppercase tracking-[0.05em] text-[#1a1a1a] no-underline">
                PROFILE
              </a>
              <button type="button" (click)="logout()"
                      class="inline-flex h-[44px] items-center rounded-[50px] border border-black bg-black px-6 text-[12px] font-[600] uppercase tracking-[0.05em] text-white">
                LOGOUT
              </button>
            </div>
          } @else {
            <div class="flex items-center gap-3">
              <a routerLink="/login" (click)="closeMobileMenu()"
                 class="inline-flex h-[44px] items-center rounded-[50px] border border-[#dddddd] bg-white px-6 text-[12px] font-[600] uppercase tracking-[0.05em] text-[#1a1a1a] no-underline">
                LOGIN
              </a>
              <a routerLink="/signup" (click)="closeMobileMenu()"
                 class="inline-flex h-[44px] items-center rounded-[50px] border border-black bg-black px-6 text-[12px] font-[600] uppercase tracking-[0.05em] text-white no-underline">
                SIGN UP
              </a>
            </div>
          }
        </div>
      </div>
    }

    @if (isAddModalOpen()) {
      <div
        class="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
        (click)="closeAddModal()"
      >
        <div
          class="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-5 flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-bold tracking-tight text-black">Add New Title</h2>
              <p class="mt-1 text-[11px] font-mono uppercase tracking-widest text-black/55">
                Add to your watchlist
              </p>
            </div>
            <button
              type="button"
              (click)="closeAddModal()"
              class="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-black/[0.03] text-black transition-colors hover:bg-black hover:text-white"
            >
              <lucide-icon name="x" class="h-4 w-4"></lucide-icon>
            </button>
          </div>

          <form class="space-y-4" (submit)="addTitle($event)">
            <div>
              <label
                class="mb-2 block text-[10px] font-mono uppercase tracking-widest text-black/45"
                >Title</label
              >
              <input
                type="text"
                [(ngModel)]="newItem.title"
                name="title"
                required
                class="w-full rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-black/25 focus:bg-white"
                placeholder="e.g. Inception"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label
                  class="mb-2 block text-[10px] font-mono uppercase tracking-widest text-black/45"
                  >Type</label
                >
                <select
                  [(ngModel)]="newItem.type"
                  name="type"
                  class="w-full rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-black/25 focus:bg-white"
                >
                  <option value="movie">Movie</option>
                  <option value="tv">TV Show</option>
                </select>
              </div>

              <div>
                <label
                  class="mb-2 block text-[10px] font-mono uppercase tracking-widest text-black/45"
                  >Year</label
                >
                <input
                  type="text"
                  [(ngModel)]="newItem.year"
                  name="year"
                  class="w-full rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-black/25 focus:bg-white"
                  placeholder="2026"
                />
              </div>
            </div>

            <div>
              <label
                class="mb-2 block text-[10px] font-mono uppercase tracking-widest text-black/45"
                >Genre</label
              >
              <input
                type="text"
                [(ngModel)]="newItem.genre"
                name="genre"
                class="w-full rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-black/25 focus:bg-white"
                placeholder="Sci-Fi"
              />
            </div>

            <div>
              <label
                class="mb-2 block text-[10px] font-mono uppercase tracking-widest text-black/45"
                >Poster URL</label
              >
              <input
                type="text"
                [(ngModel)]="newItem.posterPath"
                name="posterPath"
                class="w-full rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-black/25 focus:bg-white"
                placeholder="https://..."
              />
            </div>

            <button
              type="submit"
              [disabled]="isSubmittingAdd()"
              class="w-full rounded-xl bg-black py-3 text-[11px] font-mono uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {{ isSubmittingAdd() ? 'Adding...' : 'Add to Watchlist' }}
            </button>
          </form>
        </div>
      </div>
    }
  `,
})
export class HeaderComponent implements OnDestroy, AfterViewInit {
  state = inject(StateService);
  auth = inject(AuthService);
  private router = inject(Router);
  private watchlistService = inject(WatchlistService);

  @ViewChild('searchShell') searchShell?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChildren('pillButton') pillButtons!: QueryList<ElementRef>;
  @ViewChildren('navButton') navButtons!: QueryList<ElementRef>;

  currentUrl = signal<string>('/');
  isAuthPage = computed(() => this.currentUrl() === '/login' || this.currentUrl() === '/signup');
  isLoginPage = computed(() => this.currentUrl() === '/login');
  isSignupPage = computed(() => this.currentUrl() === '/signup');

  activeNavPath = signal<'/home' | '/watchlist'>('/home');
  isSearchExpanded = signal(false);
  mobileMenuOpen = signal(false);
  isAddModalOpen = signal(false);
  isSubmittingAdd = signal(false);
  pills = ['All', 'Netflix', 'Prime Video', 'JioHotstar', 'ZEE5', 'SonyLIV'];

  navIndicatorLeft = signal(0);
  navIndicatorWidth = signal(0);
  pillIndicatorLeft = signal(0);
  pillIndicatorWidth = signal(0);

  newItem = {
    title: '',
    type: 'movie' as const,
    year: '',
    genre: '',
    posterPath: '',
    status: 'want' as const,
    contentId: '',
  };

  private routerSub: Subscription;

  constructor() {
    this.setActiveNavByUrl(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.setActiveNavByUrl(event.urlAfterRedirects));

    effect(() => {
      const active = this.state.activePill();
      const navPath = this.activeNavPath();
      setTimeout(() => this.updatePillIndicator());
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updatePillIndicator(), 100);
  }

  updatePillIndicator(): void {
    if (this.pillButtons) {
      const index = this.pills.indexOf(this.state.activePill());
      if (index !== -1) {
        const button = this.pillButtons.toArray()[index];
        if (button) {
          const el = button.nativeElement;
          this.pillIndicatorLeft.set(el.offsetLeft);
          this.pillIndicatorWidth.set(el.offsetWidth);
        }
      }
    }
    
    if (this.navButtons) {
      const paths = ['/home', '/watchlist'];
      const index = paths.indexOf(this.activeNavPath());
      if (index !== -1) {
        const button = this.navButtons.toArray()[index];
        if (button) {
          const el = button.nativeElement;
          this.navIndicatorLeft.set(el.offsetLeft);
          this.navIndicatorWidth.set(el.offsetWidth);
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.routerSub.unsubscribe();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent): void {
    if (!this.isSearchExpanded()) {
      return;
    }

    const shell = this.searchShell?.nativeElement;
    const target = event.target;

    if (shell && target instanceof Node && !shell.contains(target)) {
      this.closeSearch();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeSearch();
    if (this.mobileMenuOpen()) {
      this.mobileMenuOpen.set(false);
    }
    if (this.isAddModalOpen()) {
      this.closeAddModal();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updatePillIndicator();
  }

  setActiveNav(path: '/home' | '/watchlist'): void {
    this.activeNavPath.set(path);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((value) => !value);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  setActivePill(pill: string): void {
    this.state.activePill.set(pill);
    const providerId = PROVIDER_TO_TMDB_ID[pill] ?? null;
    this.state.selectedProviderId.set(providerId);
    this.state.selectedWatchRegion.set('IN');
  }

  toggleSearch(event?: Event): void {
    event?.stopPropagation();

    if (this.isSearchExpanded()) {
      this.closeSearch();
      return;
    }

    this.isSearchExpanded.set(true);
    setTimeout(() => this.searchInput?.nativeElement.focus(), 220);
  }

  closeSearch(): void {
    this.isSearchExpanded.set(false);
  }

  onSearchChange(value: string): void {
    const query = value.trim();
    this.state.searchQuery.set(query);

    const isSearchablePage =
      this.currentUrl().startsWith('/browse/') || this.currentUrl().startsWith('/search');

    if (isSearchablePage) {
      void this.router.navigate([this.currentUrl()], {
        queryParams: {
          q: query || null,
          page: 1,
        },
        queryParamsHandling: 'merge',
      });
    } else if (query) {
      void this.router.navigate(['/search'], {
        queryParams: {
          q: query,
          page: 1,
        },
      });
    }
  }

  closeAddModal(): void {
    this.isAddModalOpen.set(false);
    this.isSubmittingAdd.set(false);
  }

  addTitle(event: Event): void {
    event.preventDefault();
    if (!this.newItem.title.trim() || this.isSubmittingAdd()) {
      return;
    }

    this.isSubmittingAdd.set(true);
    this.newItem.contentId = `custom-${Date.now()}`;

    this.watchlistService.addWatchlistItem(this.newItem).subscribe({
      next: () => {
        this.closeAddModal();
        this.resetAddForm();
      },
      error: (error) => {
        this.isSubmittingAdd.set(false);
        console.error('Error adding item:', error);
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.mobileMenuOpen.set(false);
    this.closeSearch();
    void this.router.navigateByUrl('/login');
  }

  private resetAddForm(): void {
    this.newItem = {
      title: '',
      type: 'movie',
      year: '',
      genre: '',
      posterPath: '',
      status: 'want',
      contentId: '',
    };
  }

  private setActiveNavByUrl(url: string): void {
    const urlWithoutQuery = url.split('?')[0];
    this.currentUrl.set(urlWithoutQuery);

    if (url.startsWith('/watchlist')) {
      this.activeNavPath.set('/watchlist');
      return;
    }

    this.activeNavPath.set('/home');
  }
}
