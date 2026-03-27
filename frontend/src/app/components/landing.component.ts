import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="h-screen overflow-hidden bg-[#fcfcfd] flex flex-col items-center justify-center px-6 font-['Inter',sans-serif] selection:bg-[#e2e2e7] selection:text-[#1d1d1f] antialiased">
      <div class="max-w-4xl w-full text-center reveal">
        <!-- Badge -->
        <span class="inline-block border border-[#e2e2e7] text-[#8e8e93] text-[10px] font-mono tracking-[0.2em] px-3 py-1.5 rounded-full mb-8 uppercase bg-[#ffffff]">
          Introducing
        </span>

        <!-- Title -->
        <h1 class="text-5xl md:text-7xl font-sans font-medium tracking-tight text-[#1d1d1f] leading-tight mb-6">
          StreamTrack.<br />
          <span class="text-[#8e8e93]">All your shows in one place.</span>
        </h1>

        <!-- Subtitle -->
        <p class="text-lg md:text-xl font-sans text-[#8e8e93] max-w-2xl mx-auto mb-12 font-light leading-relaxed">
          Find what to watch based on your mood, track your favorites effortlessly, and never lose track of a TV series again. Experience the most elegant way to catalog your entertainment.
        </p>

        <!-- CTA Action -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 reveal delay-1">
          <a
            routerLink="/home"
            class="bg-[#1d1d1f] hover:bg-black text-[#ffffff] px-8 py-3.5 rounded-full font-sans text-[15px] font-medium transition-transform active:scale-95 shadow-sm min-w-[200px]"
          >
            Get Started
          </a>
          <a
            routerLink="/signup"
            class="bg-[#ffffff] hover:bg-[#fcfcfd] border border-[#e2e2e7] text-[#1d1d1f] px-8 py-3.5 rounded-full font-sans text-[15px] font-medium transition-colors hover:border-[#8e8e93] active:scale-95 min-w-[200px]"
          >
            Create Account
          </a>
        </div>

        <!-- Footer / Metadata -->
        <div class="mt-20 pt-8 border-t border-[#e2e2e7] text-[#8e8e93] text-[10px] font-mono tracking-widest uppercase flex flex-wrap justify-center gap-6 reveal delay-2">
          <span>Design-Driven</span>
          <span>Apple-Inspired</span>
          <span>Open API</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Subtle fade-in animation */
    .reveal {
      opacity: 0;
      animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .delay-1 { animation-delay: 0.2s; }
    .delay-2 { animation-delay: 0.4s; }

    @keyframes fadeUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class LandingComponent {}
