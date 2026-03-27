import { ApplicationConfig } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withInMemoryScrolling } from '@angular/router';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  LucideAngularModule,
  Search,
  Plus,
  X,
  Play,
  Star,
  Clock,
  Calendar,
  LayoutGrid,
  List,
  Check,
  ChevronDown,
  User,
  TrendingUp,
  Film,
  Moon,
  Zap,
  Brain,
  Coffee,
  Heart,
  CheckCircle,
  Activity,
  ArrowLeft,
  Bookmark,
  AlignJustify,
  Trash2,
} from 'lucide-angular';

import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { HomeWatchlistReuseStrategy } from './home-watchlist-reuse.strategy';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
    ),
    { provide: RouteReuseStrategy, useClass: HomeWatchlistReuseStrategy },
    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(
      LucideAngularModule.pick({
        Search,
        Plus,
        X,
        Play,
        Star,
        Clock,
        Calendar,
        LayoutGrid,
        List,
        Check,
        ChevronDown,
        User,
        TrendingUp,
        Film,
        Moon,
        Zap,
        Brain,
        Coffee,
        Heart,
        CheckCircle,
        Activity,
        ArrowLeft,
        Bookmark,
        AlignJustify,
        Trash2,
      }),
    ),
  ],
};
