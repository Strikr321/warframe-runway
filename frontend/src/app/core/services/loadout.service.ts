import { Injectable, effect, signal } from '@angular/core';
import { Loadout, MAX_LOADOUTS_PER_FRAME, emptyAttachments } from '../models/loadout.model';
import { colorStateFromSummary } from '../../data/channels.data';
import { demoLoadouts } from '../../data/demo-loadouts.data';

/**
 * Single owner of loadout data. Pages inject it; child components receive
 * data through inputs. Persists to localStorage today; this is the one file
 * that changes when persistence moves to the Spring Boot API.
 */
@Injectable({ providedIn: 'root' })
export class LoadoutService {
  /** Versioned key: bump it and add a migration whenever the stored shape changes. */
  private static readonly STORAGE_KEY = 'warframe-runway.loadouts.v2';
  private static readonly LEGACY_KEY_V1 = 'warframe-runway.loadouts.v1';

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
    return this._loadouts().filter((l) => l.frame === frame);
  }

  byId(id: string): Loadout | undefined {
    return this._loadouts().find((l) => l.id === id);
  }

  /** Gates creating a new loadout; editing an existing one is always allowed. */
  canAddLoadout(frame: string): boolean {
    return this.byFrame(frame).length < MAX_LOADOUTS_PER_FRAME;
  }

  // ── Writes ────────────────────────────────────────────────
  /** Create or update. Returns false if a new loadout would exceed the per-frame cap. */
  save(loadout: Loadout): boolean {
    const isNew = !this._loadouts().some((l) => l.id === loadout.id);
    if (isNew && !this.canAddLoadout(loadout.frame)) return false;

    this._loadouts.update((all) => {
      const stamped = { ...loadout, edited: new Date().toISOString() };
      return isNew ? [...all, stamped] : all.map((l) => (l.id === loadout.id ? stamped : l));
    });
    return true;
  }

  delete(id: string): void {
    this._loadouts.update((all) => all.filter((l) => l.id !== id));
  }

  toggleFav(id: string): void {
    this._loadouts.update((all) => all.map((l) => (l.id === id ? { ...l, fav: !l.fav } : l)));
  }

  // ── Storage plumbing ──────────────────────────────────────
  private loadFromStorage(): Loadout[] {
    try {
      const raw = localStorage.getItem(LoadoutService.STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Loadout[];

      const legacy = localStorage.getItem(LoadoutService.LEGACY_KEY_V1);
      if (!legacy) return [];
      const migrated = migrateV1(JSON.parse(legacy) as LoadoutV1[]);
      localStorage.removeItem(LoadoutService.LEGACY_KEY_V1);
      return migrated;
    } catch {
      // Corrupt data shouldn't crash the app on boot.
      return [];
    }
  }

  // ── Demo data ─────────────────────────────────────────────
  seedDemo(): void {
    this._loadouts.set(demoLoadouts());
  }
}

/** v1 stored a 4-color summary and could omit attachments/colorState. */
interface LoadoutV1 extends Omit<Loadout, 'attachments' | 'colorState'> {
  colors?: string[];
  attachments?: Loadout['attachments'];
  colorState?: Loadout['colorState'];
}

function migrateV1(items: LoadoutV1[]): Loadout[] {
  return items.map(({ colors, attachments, colorState, ...rest }) => ({
    ...rest,
    attachments: attachments ?? emptyAttachments(),
    colorState: colorState ?? colorStateFromSummary(colors ?? []),
  }));
}
