import { Component, computed, inject, signal } from '@angular/core';
import { FRAMES, Loadout } from '../../models/loadout.model';
import { LoadoutService } from '../../services/loadout.service';
import { StatsBanner } from '../../components/stats-banner/stats-banner';
import { RecentRow } from '../../components/recent-row/recent-row';
import { ControlsBar, ViewMode, ChipFilter } from '../../components/controls-bar/controls-bar';
import { FrameCard } from '../../components/frame-card/frame-card';

/**
 * STEP 3 CHANGE: the page no longer OWNS data — it ASKS for it.
 *
 *   Step 2:  loadouts = signal(DUMMY_LOADOUTS)     // page owns data
 *   Step 3:  loadouts = this.store.loadouts        // service owns data
 *
 * `inject(LoadoutService)` is dependency injection: Angular hands us
 * THE shared instance (same one the Builder will get in Step 4).
 * Everything downstream — stats, recent, filters — is untouched,
 * because computed() doesn't care WHERE the signal came from.
 */
@Component({
  selector: 'app-collection',
  imports: [StatsBanner, RecentRow, ControlsBar, FrameCard],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
})
export class Collection {
  private store = inject(LoadoutService);

  // ── State ────────────────────────────────────────────────
  loadouts = this.store.loadouts;        // read-only signal from the service
  view = signal<ViewMode>('frame');
  search = signal('');
  filter = signal<ChipFilter>('all');

  frames = FRAMES;
  toast = signal('');

  // ── Derived state (identical to Step 2 — that's the point) ──
  stats = computed(() => {
    const all = this.loadouts();
    return {
      styled: new Set(all.map(l => l.frame)).size,
      total: FRAMES.length,
      loadouts: all.length,
      favorites: all.filter(l => l.fav).length,
    };
  });

  /** Now genuinely recent: real timestamps, sorted newest first. */
  recent = computed(() =>
    [...this.loadouts()]
      .sort((a, b) => b.edited.localeCompare(a.edited))
      .slice(0, 4)
  );

  filteredFrames = computed(() => {
    const q = this.search().toLowerCase();
    const f = this.filter();
    // Reading loadouts() here makes this computed re-run on data changes
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

  // ── Helpers & event handlers ─────────────────────────────
  loadoutsFor(frame: string): Loadout[] {
    return this.store.byFrame(frame);
  }

  openFrame(frame: string) {
    const n = this.loadoutsFor(frame).length;
    this.showToast(`Opening ${frame} — ${n} loadout${n > 1 ? 's' : ''}`);
    // Step 4: router.navigate(['/builder', id])
  }

  openLoadout(l: Loadout) {
    this.showToast(`Opening ${l.frame} — ${l.name}`);
  }

  newLoadout() {
    this.showToast('Opening editor — New Loadout');
  }

  /** Favorites now go through the service — one door for writes. */
  toggleFav(frame: string) {
    const first = this.loadoutsFor(frame)[0];
    if (first) this.store.toggleFav(first.id);
  }

  toggleFavLoadout(l: Loadout) {
    this.store.toggleFav(l.id);
  }

  // ── Demo data controls (temporary until the Builder exists) ──
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
