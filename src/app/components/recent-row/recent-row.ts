import { Component, input, output } from '@angular/core';
import { Loadout } from '../../models/loadout.model';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';

/**
 * Same component as Step 2 — the only change is importing TimeAgoPipe
 * so the template can render the new ISO timestamps as "2 hours ago".
 */
@Component({
  selector: 'app-recent-row',
  imports: [TimeAgoPipe],
  templateUrl: './recent-row.html',
  styleUrl: './recent-row.css',
})
export class RecentRow {
  loadouts = input.required<Loadout[]>();
  open = output<Loadout>();
}
