import { Component, output, signal } from '@angular/core';

export type ViewMode = 'frame' | 'loadout';
export type ChipFilter = 'all' | 'has' | 'empty';

/**
 * PURE EVENT COMPONENT.
 * Owns zero data about loadouts. Its only job is translating user
 * intent (typed search, toggled view, tapped chip) into events the
 * page listens to. The page does the actual filtering — if filtering
 * lived here too, two components would fight over one list.
 *
 * It keeps tiny bits of UI state (which button looks active) as
 * signals — local state is fine; DATA is what must live upstream.
 */
@Component({
  selector: 'app-controls-bar',
  imports: [],
  templateUrl: './controls-bar.html',
  styleUrl: './controls-bar.css',
})
export class ControlsBar {
  viewChange = output<ViewMode>();
  searchChange = output<string>();
  filterChange = output<ChipFilter>();

  view = signal<ViewMode>('frame');
  filter = signal<ChipFilter>('all');

  setView(v: ViewMode) {
    this.view.set(v);
    this.viewChange.emit(v);
  }

  setFilter(f: ChipFilter) {
    this.filter.set(f);
    this.filterChange.emit(f);
  }

  onSearch(e: Event) {
    // Event targets are generic; we narrow to the input element to read .value
    this.searchChange.emit((e.target as HTMLInputElement).value);
  }
}
