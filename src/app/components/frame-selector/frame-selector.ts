import { Component, input, output } from '@angular/core';
import { FRAMES } from '../../models/loadout.model';

/**
 * DUMB DISPLAY + EVENT COMPONENT.
 * The scrollable button strip of all frames. Same pattern you've
 * seen several times now: receive current state, report the intent,
 * own nothing — including, now, where the frame LIST itself comes
 * from. `frames` used to be a hardcoded import; now it's an input,
 * defaulting to that same hardcoded list so nothing breaks if a
 * parent forgets to pass one, but Builder now passes the live,
 * fetched catalog instead (see FrameCatalogService).
 */
@Component({
  selector: 'app-frame-selector',
  imports: [],
  templateUrl: './frame-selector.html',
  styleUrl: './frame-selector.css',
})
export class FrameSelector {
  selected = input.required<string>();
  frames = input<string[]>(FRAMES);
  select = output<string>();
}
