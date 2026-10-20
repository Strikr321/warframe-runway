import { Component, output, signal } from '@angular/core';

export type ViewMode = 'frame' | 'loadout';
export type ChipFilter = 'all' | 'has' | 'empty';

/** View toggle, search box, and filter chips. Emits intent; the page does the filtering. */
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
    this.searchChange.emit((e.target as HTMLInputElement).value);
  }
}
