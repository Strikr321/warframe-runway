import { Component, input, output } from '@angular/core';
import { FRAMES } from '../../models/loadout.model';

/**
 * DUMB DISPLAY + EVENT COMPONENT.
 * The scrollable button strip of all 64 frames. Same pattern you've
 * seen three times now: receive current state, report the intent,
 * own nothing.
 */
@Component({
  selector: 'app-frame-selector',
  imports: [],
  templateUrl: './frame-selector.html',
  styleUrl: './frame-selector.css',
})
export class FrameSelector {
  selected = input.required<string>();
  select = output<string>();

  frames = FRAMES;
}
