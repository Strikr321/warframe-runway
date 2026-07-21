import { Component, input, output } from '@angular/core';
import { Loadout } from '../../models/loadout.model';

/**
 * DISPLAY + EVENT COMPONENT.
 * Gets a ready-sorted list of loadouts (the page decides "recent"),
 * shows them as a horizontal strip, and REPORTS clicks upward.
 * It does not navigate anywhere itself — that's a page decision.
 *
 * `output()` creates an @Output: an event the parent can listen to
 * with (open)="..." in its template.
 */
@Component({
  selector: 'app-recent-row',
  imports: [],
  templateUrl: './recent-row.html',
  styleUrl: './recent-row.css',
})
export class RecentRow {
  loadouts = input.required<Loadout[]>();
  open = output<Loadout>();   // fired when a card is clicked
}
