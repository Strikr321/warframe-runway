import { Injectable, effect, signal } from '@angular/core';
import { Loadout, MAX_LOADOUTS_PER_FRAME } from '../models/loadout.model';

/**
 * Single owner of loadout data. Pages inject it; child components receive
 * data through inputs. Persists to localStorage today; this is the one file
 * that changes when persistence moves to the Spring Boot API.
 */
@Injectable({ providedIn: 'root' })
export class LoadoutService {
  /** Versioned key: if the data shape ever changes, bump v1 → v2. */
  private static readonly STORAGE_KEY = 'warframe-runway.loadouts.v1';

  /** Writable only through the methods below. */
  private readonly _loadouts = signal<Loadout[]>(this.loadFromStorage());
  readonly loadouts = this._loadouts.asReadonly();

  constructor() {
    // Persist on every change.
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

  /** Gates creating a new loadout; editing an existing one is always allowed. */
  canAddLoadout(frame: string): boolean {
    return this.byFrame(frame).length < MAX_LOADOUTS_PER_FRAME;
  }

  // ── Writes ────────────────────────────────────────────────
  /** Create or update. Returns false if a new loadout would exceed the per-frame cap. */
  save(loadout: Loadout): boolean {
    const isNew = !this._loadouts().some(l => l.id === loadout.id);
    if (isNew && !this.canAddLoadout(loadout.frame)) return false;

    this._loadouts.update(all => {
      const stamped = { ...loadout, edited: new Date().toISOString() };
      return isNew ? [...all, stamped] : all.map(l => (l.id === loadout.id ? stamped : l));
    });
    return true;
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
      // Corrupt data shouldn't crash the app on boot.
      return [];
    }
  }

  // ── Demo data ─────────────────────────────────────────────
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

  clearAll(): void {
    this._loadouts.set([]);
  }
}
