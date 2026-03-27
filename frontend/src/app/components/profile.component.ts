import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { WatchlistService, WatchlistStats } from '../services/watchlist.service';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterLink],
  template: `
    <div class="max-w-4xl mx-auto py-12 px-6">
      @if (auth.isAuthenticated()) {
        <div class="flex flex-col md:flex-row items-center gap-8 mb-16">
          <div
            class="w-32 h-32 rounded-full bg-black/5 border-2 border-black/[0.08] flex items-center justify-center overflow-hidden"
          >
            @if (auth.currentUser()?.photoURL) {
              <img
                [src]="auth.currentUser()?.photoURL"
                [alt]="auth.currentUser()?.name || 'Profile photo'"
                referrerpolicy="no-referrer"
                class="h-full w-full object-cover"
              />
            } @else {
              <lucide-icon name="user" class="w-16 h-16 text-black/20"></lucide-icon>
            }
          </div>
          <div class="text-center md:text-left">
            <h1 class="text-4xl font-bold tracking-tight text-black mb-2">
              {{ auth.currentUser()?.name || 'User Profile' }}
            </h1>
            <p class="text-black/60 font-mono text-sm uppercase tracking-widest">
              {{ auth.currentUser()?.email }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div class="bg-white border border-black/[0.08] p-8 rounded-2xl shadow-sm">
            <h3 class="text-[10px] font-mono text-black/40 uppercase tracking-widest mb-4">
              Total Watchlist
            </h3>
            <p class="text-4xl font-bold text-black">{{ stats()?.total || 0 }}</p>
          </div>
          <div class="bg-white border border-black/[0.08] p-8 rounded-2xl shadow-sm">
            <h3 class="text-[10px] font-mono text-black/40 uppercase tracking-widest mb-4">
              Watched
            </h3>
            <p class="text-4xl font-bold text-black">{{ stats()?.watched || 0 }}</p>
          </div>
          <div class="bg-white border border-black/[0.08] p-8 rounded-2xl shadow-sm">
            <h3 class="text-[10px] font-mono text-black/40 uppercase tracking-widest mb-4">
              Watching
            </h3>
            <p class="text-4xl font-bold text-black">{{ stats()?.watching || 0 }}</p>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-8">
            <h2 class="text-2xl font-bold text-black tracking-tight">Recent Activity</h2>
            <a
              routerLink="/"
              class="text-[11px] font-mono text-black/60 uppercase tracking-widest hover:text-black transition-colors no-underline"
              >Back to Explore</a
            >
          </div>

          <div class="bg-white border border-black/[0.08] rounded-2xl overflow-hidden">
            <div class="p-8 border-b border-black/[0.05] flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                  <lucide-icon name="activity" class="w-4 h-4 text-black/60"></lucide-icon>
                </div>
                <div>
                  <p class="text-sm font-semibold text-black">Updated Watchlist</p>
                  <p class="text-[11px] text-black/40">You added new titles this week</p>
                </div>
              </div>
              <span class="text-[10px] font-mono text-black/40">Recently</span>
            </div>
            <div class="p-8 border-b border-black/[0.05] flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                  <lucide-icon name="check-circle" class="w-4 h-4 text-black/60"></lucide-icon>
                </div>
                <div>
                  <p class="text-sm font-semibold text-black">Completed a title</p>
                  <p class="text-[11px] text-black/40">Marked as Watched</p>
                </div>
              </div>
              <span class="text-[10px] font-mono text-black/40">Recently</span>
            </div>
            <div class="p-8 flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                  <lucide-icon name="star" class="w-4 h-4 text-black/60"></lucide-icon>
                </div>
                <div>
                  <p class="text-sm font-semibold text-black">Saved your favorites</p>
                  <p class="text-[11px] text-black/40">Keep building your list</p>
                </div>
              </div>
              <span class="text-[10px] font-mono text-black/40">Now</span>
            </div>
          </div>
        </div>
      } @else {
        <div class="max-w-xl mx-auto text-center border border-black/10 bg-white rounded-3xl p-10">
          <h1 class="text-3xl font-bold tracking-tight text-black mb-3">Login Required</h1>
          <p class="text-black/60 text-sm mb-8">
            Login or create an account to manage your profile and keep your watchlist synced.
          </p>
          <div class="flex items-center justify-center gap-3">
            <a
              routerLink="/login"
              class="px-5 py-3 text-[11px] font-mono uppercase tracking-widest border border-black/15 rounded-full text-black no-underline hover:bg-black hover:text-white transition-colors"
              >Login</a
            >
            <a
              routerLink="/signup"
              class="px-5 py-3 text-[11px] font-mono uppercase tracking-widest border border-black rounded-full bg-black text-white no-underline hover:opacity-90 transition-opacity"
              >Sign Up</a
            >
          </div>
        </div>
      }
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  watchlistService = inject(WatchlistService);
  auth = inject(AuthService);
  stats = signal<WatchlistStats | null>(null);

  ngOnInit() {
    this.watchlistService.getStats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: (err) => console.error('Error loading stats:', err),
    });
  }
}
