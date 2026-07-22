import { Injectable, effect, signal } from '@angular/core';
import { Loadout } from '../models/loadout.model';

/**
 * THE ONE BRAIN.
 * ==============
 * The single owner of all loadout data in the app. Pages inject it;
 * child components never see it (they get data via inputs).
 *
 * @Injectable({ providedIn: 'root' }) = Angular creates exactly ONE
 * instance for the whole app and hands that same instance to anyone
 * who asks (dependency injection). Collection and Builder therefore
 * always agree on the data, because it literally IS the same object.
 *
 * Persistence today: localStorage (survives refresh, lives in this
 * browser only). In Step 7 the bodies of these methods become HTTP
 * calls to Spring Boot — and NOTHING outside this file changes.
 * That is the entire reason this class exists.
 */
@Injectable({ providedIn: 'root' })
export class LoadoutService {
  /** Versioned key: if the data shape ever changes, bump v1 → v2. */
  private static readonly STORAGE_KEY = 'warframe-runway.loadouts.v1';

  /**
   * The source of truth. Private-writable, public-readable:
   * outsiders get `.asReadonly()` so ALL writes must go through the
   * methods below — one door in, easy to reason about.
   */
  private readonly _loadouts = signal<Loadout[]>(this.loadFromStorage());
  readonly loadouts = this._loadouts.asReadonly();

  constructor() {
    // effect() re-runs whenever a signal it reads changes.
    // Any write to _loadouts → automatically persisted. No component
    // ever has to remember to call save(). Forgetting is impossible.
    effect(() => {
      localStorage.setItem(LoadoutService.STORAGE_KEY, JSON.stringify(this._loadouts()));
    });
  }

  // ── Reads ─────────────────────────────────────────────────
  byFrame(frame: string): Loadout[] {
    return this._loadouts().filter(l => l.frame === frame);
  }

  byId(id: string): Loadout | undefined {
    return this._loadouts().find(l => l.id === id);
  }

  // ── Writes (the only door) ────────────────────────────────
  /** Create or update — the Builder calls this in Step 4. */
  save(loadout: Loadout): void {
    this._loadouts.update(all => {
      const stamped = { ...loadout, edited: new Date().toISOString() };
      const exists = all.some(l => l.id === loadout.id);
      return exists
        ? all.map(l => (l.id === loadout.id ? stamped : l))
        : [...all, stamped];
    });
  }

  delete(id: string): void {
    this._loadouts.update(all => all.filter(l => l.id !== id));
  }

  toggleFav(id: string): void {
    this._loadouts.update(all =>
      all.map(l => (l.id === id ? { ...l, fav: !l.fav } : l))
    );
  }

  // ── Storage plumbing ──────────────────────────────────────
  private loadFromStorage(): Loadout[] {
    try {
      const raw = localStorage.getItem(LoadoutService.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Loadout[]) : [];
    } catch {
      // Corrupt/unparseable data shouldn't crash the app on boot.
      return [];
    }
  }

  // ── Demo seed (until the Builder exists) ──────────────────
  /** Fills storage with sample loadouts so there's something to look at. */
  seedDemo(): void {
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    this._loadouts.set([
      { id: 'l1',  frame: 'Volt',      name: 'Corrupted Lightning', creator: 'Tenno', colors: ['#e8641a','#3080c8','#a0a0a0','#f0c050'], fav: true,  edited: hoursAgo(2) },
      { id: 'l2',  frame: 'Volt',      name: 'Prime Storm',         creator: 'Tenno', colors: ['#f0c050','#0f0505','#c8952a','#20a0e0'], fav: false, edited: hoursAgo(24) },
      { id: 'l3',  frame: 'Excalibur', name: 'Void Walker',         creator: 'Tenno', colors: ['#5166b7','#1e1e22','#f0c050','#a020e0'], fav: true,  edited: hoursAgo(3) },
      { id: 'l4',  frame: 'Mesa',      name: 'Peacemaker',          creator: 'Tenno', colors: ['#bb282b','#282724','#f0c050','#e03010'], fav: false, edited: hoursAgo(5) },
      { id: 'l5',  frame: 'Mesa',      name: 'Gunslinger Gold',     creator: 'Tenno', colors: ['#f0c050','#7a5a18','#e8d8c0','#c8952a'], fav: true,  edited: hoursAgo(26) },
      { id: 'l6',  frame: 'Wisp',      name: 'Spectral Bloom',      creator: 'Tenno', colors: ['#54bfd2','#3f9fb7','#e0e020','#a020e0'], fav: false, edited: hoursAgo(12) },
      { id: 'l7',  frame: 'Saryn',     name: 'Toxic Elegance',      creator: 'Tenno', colors: ['#41c100','#112c18','#e0e020','#a0a0a0'], fav: false, edited: hoursAgo(48) },
      { id: 'l8',  frame: 'Rhino',     name: 'Iron Sovereign',      creator: 'Tenno', colors: ['#f0c050','#3a0808','#c8952a','#e8641a'], fav: false, edited: hoursAgo(72) },
      { id: 'l9',  frame: 'Rhino',     name: 'Palatine Frost',      creator: 'Tenno', colors: ['#54c9db','#0ab6e5','#f0c050','#ffffff'], fav: false, edited: hoursAgo(120) },
      { id: 'l10', frame: 'Rhino',     name: 'Blood Iron',          creator: 'Tenno', colors: ['#952024','#200d15','#e03010','#bb282b'], fav: false, edited: hoursAgo(168) },
      { id: 'l11', frame: 'Nekros',    name: 'Soul Reaper',         creator: 'Tenno', colors: ['#0f1221','#461011','#e0e020','#a020e0'], fav: false, edited: hoursAgo(96) },
    ]);
  }

  /** Wipe everything — handy while developing. */
  clearAll(): void {
    this._loadouts.set([]);
  }
}
