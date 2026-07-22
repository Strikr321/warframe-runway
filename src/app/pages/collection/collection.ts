import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FRAMES, Loadout } from '../../models/loadout.model';
import { LoadoutService } from '../../services/loadout.service';
import { StatsBanner } from '../../components/stats-banner/stats-banner';
import { RecentRow } from '../../components/recent-row/recent-row';
import { ControlsBar, ViewMode, ChipFilter } from '../../components/controls-bar/controls-bar';
import { FrameCard } from '../../components/frame-card/frame-card';

/**
 * STEP 4 CHANGE: openFrame/openLoadout/newLoadout now navigate for
 * real instead of showing a toast. This is the moment the two pages
 * become one app — clicking a card takes you to the Builder with
 * that exact loadout loaded.
 */
@Component({
  selector: 'app-collection',
  imports: [StatsBanner, RecentRow, ControlsBar, FrameCard],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
})
export class Collection {
  private store = inject(LoadoutService);
  private router = inject(Router);

  loadouts = this.store.loadouts;
  view = signal<ViewMode>('frame');
  search = signal('');
  filter = signal<ChipFilter>('all');

  frames = FRAMES;
  toast = signal('');

  stats = computed(() => {
    const all = this.loadouts();
    return {
      styled: new Set(all.map(l => l.frame)).size,
      total: FRAMES.length,
      loadouts: all.length,
      favorites: all.filter(l => l.fav).length,
    };
  });

  recent = computed(() =>
    [...this.loadouts()].sort((a, b) => b.edited.localeCompare(a.edited)).slice(0, 4)
  );

  filteredFrames = computed(() => {
    const q = this.search().toLowerCase();
    const f = this.filter();
    const all = this.loadouts();
    return this.frames.filter(frame => {
      if (q && !frame.toLowerCase().includes(q)) return false;
      const count = all.filter(l => l.frame === frame).length;
      if (f === 'has') return count > 0;
      if (f === 'empty') return count === 0;
      return true;
    });
  });

  filteredLoadouts = computed(() => {
    const q = this.search().toLowerCase();
    return this.loadouts()
      .filter(l => !q || l.frame.toLowerCase().includes(q) || l.name.toLowerCase().includes(q))
      .sort((a, b) => a.frame.localeCompare(b.frame) || a.name.localeCompare(b.name));
  });

  loadoutsFor(frame: string): Loadout[] {
    return this.store.byFrame(frame);
  }

  /** Card in By-Warframe view is only clickable when non-empty (FrameCard enforces this),
   *  so loadoutsFor(frame)[0] is guaranteed to exist here. */
  openFrame(frame: string) {
    const first = this.loadoutsFor(frame)[0];
    this.router.navigate(['/builder', first.id]);
  }

  openLoadout(l: Loadout) {
    this.router.navigate(['/builder', l.id]);
  }

  /** No frame preselected — the Builder defaults to the first frame in the list. */
  newLoadout() {
    this.router.navigate(['/builder']);
  }

  toggleFav(frame: string) {
    const first = this.loadoutsFor(frame)[0];
    if (first) this.store.toggleFav(first.id);
  }

  toggleFavLoadout(l: Loadout) {
    this.store.toggleFav(l.id);
  }

  seedDemo() {
    this.store.seedDemo();
    this.showToast('Sample loadouts loaded');
  }

  clearAll() {
    this.store.clearAll();
    this.showToast('All loadouts cleared');
  }

  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2500);
  }
}
