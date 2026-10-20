import { Component, input, output } from '@angular/core';
import { Loadout } from '../../../core/models/loadout.model';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { SummaryColorsPipe } from '../../../shared/pipes/summary-colors.pipe';

/** The four most recently edited loadouts; hover is linked with the Collection grid. */
@Component({
  selector: 'app-recent-row',
  imports: [TimeAgoPipe, SummaryColorsPipe],
  templateUrl: './recent-row.html',
  styleUrl: './recent-row.css',
})
export class RecentRow {
  loadouts = input.required<Loadout[]>();
  highlightedFrame = input<string | null>(null);

  open = output<Loadout>();
  hoverChange = output<{ frame: string; on: boolean }>();
}
