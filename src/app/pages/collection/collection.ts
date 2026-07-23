import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FRAMES, Loadout } from '../../models/loadout.model';
import { LoadoutService } from '../../services/loadout.service';
import { StatsBanner } from '../../components/stats-banner/stats-banner';
import { RecentRow } from '../../components/recent-row/recent-row';
import { ControlsBar, ViewMode, ChipFilter } from '../../components/controls-bar/controls-bar';
import { FrameCard } from '../../components/frame-card/frame-card';

/**
 * STEP 5 CHANGE: `hoveredFrame` is the shared signal that links the
 * Recently Edited row to the Collection grid in both directions —
 * hover either one and both the matching grid card (fan-out + glow)
 * and the matching Recently Edited card (glow) light up together.
 * Neither child component knows about the other; they only know
 * about this one shared piece of state on the page, which is the
 * whole "smart page, dumb pieces" idea paying off again.
 *
 * Empty frame cards are now clickable too (FrameCard.createRequested),
 * and any card can spawn an ADDITIONAL loadout for its frame even once
 * it already has one, up to the 6-loadout cap.
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
  hoveredFrame = signal<string | null>(null);

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

  // ── Navigation ────────────────────────────────────────────
  /** Open one specific loadout by id — from a card's cover, or from
   *  clicking a specific fanned-out mini-card. */
  openLoadoutById(id: string) {
    this.router.navigate(['/builder', id]);
  }

  /** Create a new loadout for this frame — from an empty card, the
   *  "+" on a populated card, or the generic New Loadout tile. */
  createForFrame(frame?: string) {
    if (frame) this.router.navigate(['/builder'], { queryParams: { frame } });
    else this.router.navigate(['/builder']);
  }

  // ── Hover linking (Recently Edited <-> grid, both directions) ──
  onFrameHover(frame: string, on: boolean) {
    this.hoveredFrame.set(on ? frame : null);
  }
  onRecentHover(evt: { frame: string; on: boolean }) {
    this.hoveredFrame.set(evt.on ? evt.frame : null);
  }

  // ── Favorites ─────────────────────────────────────────────
  toggleFav(frame: string) {
    const first = this.loadoutsFor(frame)[0];
    if (first) this.store.toggleFav(first.id);
  }
  toggleFavLoadout(l: Loadout) {
    this.store.toggleFav(l.id);
  }

  // ── Demo data controls (temporary until real usage builds up) ──
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
