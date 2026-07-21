import { Component, computed, signal } from '@angular/core';
import { FRAMES, DUMMY_LOADOUTS, Loadout } from '../../models/loadout.model';
import { StatsBanner } from '../../components/stats-banner/stats-banner';
import { RecentRow } from '../../components/recent-row/recent-row';
import { ControlsBar, ViewMode, ChipFilter } from '../../components/controls-bar/controls-bar';
import { FrameCard } from '../../components/frame-card/frame-card';

/**
 * SMART PAGE COMPONENT — the conductor of this screen.
 * It owns the data (dummy for now; LoadoutService takes over in
 * Step 3), computes stats and filters, and wires child components
 * together. Children display and report; the page decides.
 *
 * signal()   = reactive value; changing it updates the UI.
 * computed() = derived value that recalculates automatically when
 *              the signals it reads change. Type in the search box →
 *              search signal changes → filteredFrames recomputes →
 *              the grid re-renders. No manual "refreshGrid()" like
 *              the prototype needed — that's the whole point.
 */
@Component({
  selector: 'app-collection',
  imports: [StatsBanner, RecentRow, ControlsBar, FrameCard],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
})
export class Collection {
  // ── State ────────────────────────────────────────────────
  loadouts = signal<Loadout[]>(DUMMY_LOADOUTS);
  view = signal<ViewMode>('frame');
  search = signal('');
  filter = signal<ChipFilter>('all');

  frames = FRAMES;
  toast = signal('');

  // ── Derived state (all automatic) ────────────────────────
  stats = computed(() => {
    const all = this.loadouts();
    const styledFrames = new Set(all.map(l => l.frame));
    return {
      styled: styledFrames.size,
      total: FRAMES.length,
      loadouts: all.length,
      favorites: all.filter(l => l.fav).length,
    };
  });

  /** First 4 loadouts as "recent" (real date sorting arrives with real dates in Step 3) */
  recent = computed(() => this.loadouts().slice(0, 4));

  /** Frames surviving search + chip filter — powers the By-Warframe grid */
  filteredFrames = computed(() => {
    const q = this.search().toLowerCase();
    const f = this.filter();
    return this.frames.filter(frame => {
      if (q && !frame.toLowerCase().includes(q)) return false;
      const count = this.loadoutsFor(frame).length;
      if (f === 'has') return count > 0;
      if (f === 'empty') return count === 0;
      return true;
    });
  });

  /** Flat loadout list, sorted — powers the By-Loadout grid */
  filteredLoadouts = computed(() => {
    const q = this.search().toLowerCase();
    return this.loadouts()
      .filter(l => !q || l.frame.toLowerCase().includes(q) || l.name.toLowerCase().includes(q))
      .sort((a, b) => a.frame.localeCompare(b.frame) || a.name.localeCompare(b.name));
  });

  // ── Helpers & event handlers ─────────────────────────────
  loadoutsFor(frame: string): Loadout[] {
    return this.loadouts().filter(l => l.frame === frame);
  }

  openFrame(frame: string) {
    const n = this.loadoutsFor(frame).length;
    this.showToast(`Opening ${frame} — ${n} loadout${n > 1 ? 's' : ''}`);
    // Step 4: this becomes router.navigate(['/builder', id])
  }

  openLoadout(l: Loadout) {
    this.showToast(`Opening ${l.frame} — ${l.name}`);
  }

  newLoadout() {
    this.showToast('Opening editor — New Loadout');
  }

  toggleFav(frame: string) {
    // update() = change a signal based on its current value.
    // We rebuild the array (spread) instead of mutating, so Angular
    // sees a NEW value and knows to re-render. Immutability habit
    // now = far fewer "why didn't the UI update" bugs later.
    this.loadouts.update(all =>
      all.map(l => (l.frame === frame && l === this.loadoutsFor(frame)[0] ? { ...l, fav: !l.fav } : l))
    );
  }

  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2500);
  }
}
