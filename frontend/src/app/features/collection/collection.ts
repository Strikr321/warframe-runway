import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Loadout } from '../../core/models/loadout.model';
import { LoadoutService } from '../../core/services/loadout.service';
import { AuthService } from '../../core/services/auth.service';
import { FrameCatalogService } from '../../core/services/frame-catalog.service';
import { StatsBanner } from './stats-banner/stats-banner';
import { RecentRow } from './recent-row/recent-row';
import { ControlsBar, ViewMode, ChipFilter } from './controls-bar/controls-bar';
import { FrameCard } from './frame-card/frame-card';
import { ToastService } from '../../shared/toast/toast.service';

/**
 * The frame grid, stats, and Recently Edited row. `hoveredFrame` links the
 * grid and the Recently Edited row so hovering either highlights both.
 */
@Component({
  selector: 'app-collection',
  imports: [StatsBanner, RecentRow, ControlsBar, FrameCard],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
})
export class Collection {
  private store = inject(LoadoutService);
  auth = inject(AuthService);
  private router = inject(Router);
  catalog = inject(FrameCatalogService);
  private toast = inject(ToastService);

  loadouts = this.store.loadouts;
  state = this.store.state;
  browserSavedCount = this.store.browserSavedCount;
  busy = signal(false);
  view = signal<ViewMode>('frame');
  search = signal('');
  filter = signal<ChipFilter>('all');
  hoveredFrame = signal<string | null>(null);

  frames = this.catalog.frames;
  /** Portrait URL per frame name; empty while running on the offline fallback list. */
  portraits = computed(() => new Map(this.catalog.frameInfos().map((i) => [i.name, i.image])));

  stats = computed(() => {
    const all = this.loadouts();
    return {
      styled: new Set(all.map((l) => l.frame)).size,
      total: this.frames().length,
      loadouts: all.length,
      favorites: all.filter((l) => l.fav).length,
    };
  });

  recent = computed(() =>
    [...this.loadouts()].sort((a, b) => b.edited.localeCompare(a.edited)).slice(0, 4),
  );

  filteredFrames = computed(() => {
    const q = this.search().toLowerCase();
    const f = this.filter();
    const all = this.loadouts();
    return this.frames().filter((frame) => {
      if (q && !frame.toLowerCase().includes(q)) return false;
      const count = all.filter((l) => l.frame === frame).length;
      if (f === 'has') return count > 0;
      if (f === 'empty') return count === 0;
      return true;
    });
  });

  filteredLoadouts = computed(() => {
    const q = this.search().toLowerCase();
    return this.loadouts()
      .filter((l) => !q || l.frame.toLowerCase().includes(q) || l.name.toLowerCase().includes(q))
      .sort((a, b) => a.frame.localeCompare(b.frame) || a.name.localeCompare(b.name));
  });

  loadoutsFor(frame: string): Loadout[] {
    return this.store.byFrame(frame);
  }

  // ── Navigation ────────────────────────────────────────────
  openLoadoutById(id: string) {
    this.router.navigate(['/builder', id]);
  }

  createForFrame(frame?: string) {
    if (frame) this.router.navigate(['/builder'], { queryParams: { frame } });
    else this.router.navigate(['/builder']);
  }

  // ── Hover linking ─────────────────────────────────────────
  onFrameHover(frame: string, on: boolean) {
    this.hoveredFrame.set(on ? frame : null);
  }
  onRecentHover(evt: { frame: string; on: boolean }) {
    this.hoveredFrame.set(evt.on ? evt.frame : null);
  }

  // ── Favorites ─────────────────────────────────────────────
  toggleFav(loadoutId: string) {
    this.store.toggleFav(loadoutId);
  }

  constructor() {
    // Load the collection whenever someone is signed in (initially, or after signing in again).
    effect(() => {
      if (this.auth.signedIn()) untracked(() => this.store.ensureLoaded());
    });
  }

  signIn() {
    this.auth.signIn();
  }

  retry() {
    this.store.reload();
  }

  // ── Demo data and browser import ──────────────────────────
  async seedDemo() {
    this.busy.set(true);
    await this.store.seedDemo();
    this.busy.set(false);
    this.toast.show('Sample loadouts loaded');
  }

  async importBrowserSaved() {
    this.busy.set(true);
    const count = await this.store.importBrowserSaved();
    this.busy.set(false);
    const left = this.browserSavedCount();
    this.toast.show(
      left
        ? `Imported ${count}; ${left} couldn't be (frame at the 6-loadout limit)`
        : `Imported ${count} loadout${count === 1 ? '' : 's'}`,
    );
  }
}
