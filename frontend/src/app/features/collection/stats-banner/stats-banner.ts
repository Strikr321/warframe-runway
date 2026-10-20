import { Component, input } from '@angular/core';

/** Frames styled, total loadouts, and favorites. */
@Component({
  selector: 'app-stats-banner',
  imports: [],
  templateUrl: './stats-banner.html',
  styleUrl: './stats-banner.css',
})
export class StatsBanner {
  styled = input.required<number>(); // frames with ≥1 loadout
  total = input.required<number>(); // total frames in the game
  loadouts = input.required<number>();
  favorites = input.required<number>();

  /** Width of the progress bar as a percentage, e.g. 10.9 */
  get pct(): number {
    return this.total() ? (this.styled() / this.total()) * 100 : 0;
  }
}
