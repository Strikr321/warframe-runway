import { Component, input } from '@angular/core';

/**
 * DUMB DISPLAY COMPONENT.
 * Receives already-computed numbers via inputs and renders them.
 * It calculates nothing and fetches nothing — that's the page's job.
 *
 * `input()` creates a signal-based @Input. Read it in the template
 * with parentheses: styled().  `.required` = the parent MUST provide it
 * or the compiler complains.
 */
@Component({
  selector: 'app-stats-banner',
  imports: [],
  templateUrl: './stats-banner.html',
  styleUrl: './stats-banner.css',
})
export class StatsBanner {
  styled = input.required<number>();     // frames with ≥1 loadout
  total = input.required<number>();      // total frames in the game
  loadouts = input.required<number>();
  favorites = input.required<number>();

  /** Width of the progress bar as a percentage, e.g. 10.9 */
  get pct(): number {
    return this.total() ? (this.styled() / this.total()) * 100 : 0;
  }
}
