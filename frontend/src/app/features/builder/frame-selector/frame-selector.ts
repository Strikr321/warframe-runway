import { Component, input, output } from '@angular/core';

/** Scrollable strip of frame buttons. */
@Component({
  selector: 'app-frame-selector',
  imports: [],
  templateUrl: './frame-selector.html',
  styleUrl: './frame-selector.css',
})
export class FrameSelector {
  selected = input.required<string>();
  frames = input.required<string[]>();
  frameSelect = output<string>();
}
