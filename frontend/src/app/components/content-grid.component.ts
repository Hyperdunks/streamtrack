import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContentItem } from '../services/content.service';
import { ShowCardComponent } from './show-card.component';

@Component({
  selector: 'app-content-grid',
  standalone: true,
  imports: [CommonModule, RouterLink, ShowCardComponent],
  template: `
    <section class="mt-10 lg:mt-16">
      <div class="mb-4 flex items-end justify-between gap-4 lg:mb-6">
        <h2 class="text-2xl font-bold tracking-tight text-black">{{ title }}</h2>

        <div class="flex items-center gap-2">
          @if (showSliderControls()) {
            <button
              type="button"
              (click)="scrollRail(-1)"
              [disabled]="!canScrollPrev"
              class="h-8 w-8 rounded-full border border-black/15 text-black/80 transition-colors enabled:hover:bg-black enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Scroll left"
            >
              &lt;
            </button>
            <button
              type="button"
              (click)="scrollRail(1)"
              [disabled]="!canScrollNext"
              class="h-8 w-8 rounded-full border border-black/15 text-black/80 transition-colors enabled:hover:bg-black enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Scroll right"
            >
              &gt;
            </button>
          }

          @if (showViewAllButton()) {
            <a
              [routerLink]="viewAllLink"
              class="text-[11px] font-mono uppercase tracking-widest text-black/55 transition-colors hover:text-black no-underline"
            >
              View All
            </a>
          }
        </div>
      </div>

      @if (layout === 'rail') {
        <div
          #railScroller
          (scroll)="onRailScroll()"
          class="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth pb-2 pr-2 lg:gap-6"
        >
          @for (item of visibleItems(); track item.id) {
            <app-show-card [item]="item" [mode]="'rail'"></app-show-card>
          }
        </div>
      } @else {
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
          @for (item of visibleItems(); track item.id) {
            <app-show-card [item]="item" [mode]="'grid'"></app-show-card>
          }
        </div>
      }
    </section>
  `,
})
export class ContentGridComponent implements AfterViewInit, OnChanges {
  @Input() title: string = '';
  @Input() items: ContentItem[] = [];
  @Input() viewAllLink: string | null = null;
  @Input() maxItems: number | null = 12;
  @Input() layout: 'rail' | 'grid' = 'rail';
  @Input() enableSlider: boolean = false;

  @ViewChild('railScroller') railScroller?: ElementRef<HTMLDivElement>;

  canScrollPrev = false;
  canScrollNext = false;

  ngAfterViewInit(): void {
    setTimeout(() => this.updateScrollState(), 0);
  }

  ngOnChanges(): void {
    setTimeout(() => this.updateScrollState(), 0);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateScrollState();
  }

  onRailScroll(): void {
    this.updateScrollState();
  }

  showViewAllButton(): boolean {
    return (
      this.maxItems !== null &&
      this.maxItems > 0 &&
      !!this.viewAllLink &&
      this.items.length > this.maxItems
    );
  }

  showSliderControls(): boolean {
    return this.layout === 'rail' && this.enableSlider && this.visibleItems().length > 1;
  }

  scrollRail(direction: -1 | 1): void {
    const rail = this.railScroller?.nativeElement;
    if (!rail) {
      return;
    }

    const delta = Math.max(280, Math.floor(rail.clientWidth * 0.85));
    rail.scrollBy({ left: delta * direction, behavior: 'smooth' });

    setTimeout(() => this.updateScrollState(), 280);
  }

  visibleItems(): ContentItem[] {
    if (this.maxItems === null || this.maxItems <= 0) {
      return this.items;
    }

    return this.items.slice(0, this.maxItems);
  }

  private updateScrollState(): void {
    const rail = this.railScroller?.nativeElement;
    if (!rail || this.layout !== 'rail') {
      this.canScrollPrev = false;
      this.canScrollNext = false;
      return;
    }

    const epsilon = 2;
    this.canScrollPrev = rail.scrollLeft > epsilon;
    this.canScrollNext = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - epsilon;
  }
}
