import { Component, input, output } from '@angular/core';
import { Loadout } from '../../models/loadout.model';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';

/**
 * Step 5 addition: `highlightedFrame` lets the page tell this row when
 * a matching card in the Collection grid is being hovered, so the
 * corresponding entry here can glow too — and `hoverChange` reports
 * back the other direction, so hovering a card HERE fans out its
 * match in the grid. Same shared signal on the page, two components
 * both reading and writing it — that's the whole mechanism.
 */
@Component({
  selector: 'app-recent-row',
  imports: [TimeAgoPipe],
  templateUrl: './recent-row.html',
  styleUrl: './recent-row.css',
})
export class RecentRow {
  loadouts = input.required<Loadout[]>();
  highlightedFrame = input<string | null>(null);

  open = output<Loadout>();
  hoverChange = output<{ frame: string; on: boolean }>();
}
