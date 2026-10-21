import { Component, input, output } from '@angular/core';
import { Loadout } from '../../../core/models/loadout.model';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { SummaryColorsPipe } from '../../../shared/pipes/summary-colors.pipe';
import { HoverTarget, isHoverMatch } from '../hover-target';

/** The four most recently edited loadouts; hover is linked with the Collection grid. */
@Component({
  selector: 'app-recent-row',
  imports: [TimeAgoPipe, SummaryColorsPipe],
  templateUrl: './recent-row.html',
  styleUrl: './recent-row.css',
})
export class RecentRow {
  loadouts = input.required<Loadout[]>();
  /** What is hovered on the page; this row lights the matching loadout(s). */
  hovered = input<HoverTarget | null>(null);

  open = output<Loadout>();
  /** This card's loadout while hovered, null when the pointer leaves. */
  hoverChange = output<HoverTarget | null>();

  isLinked(l: Loadout): boolean {
    return isHoverMatch(this.hovered(), l.frame, l.id);
  }
}
