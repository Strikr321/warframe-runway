import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LoadoutApi, LoadoutDraft } from '../api/loadout-api';
import { problemDetail } from '../api/api-error.interceptor';
import { Loadout, MAX_LOADOUTS_PER_FRAME, emptyAttachments } from '../models/loadout.model';
import { colorStateFromSummary } from '../../data/channels.data';
import { demoLoadouts } from '../../data/demo-loadouts.data';

export type LoadState = 'loading' | 'ready' | 'error';

export type SaveResult =
  { ok: true; loadout: Loadout } | { ok: false; reason: 'limit' | 'error'; message: string };

/**
 * Single owner of loadout data. Pages read its signals; writes go to the API first and update
 * the in-memory list from the server's response, so the UI always shows what was persisted.
 */
@Injectable({ providedIn: 'root' })
export class LoadoutService {
  private api = inject(LoadoutApi);

  private readonly _loadouts = signal<Loadout[]>([]);
  readonly loadouts = this._loadouts.asReadonly();

  private readonly _state = signal<LoadState>('loading');
  readonly state = this._state.asReadonly();

  /** Loadouts saved in this browser before the API existed, waiting to be imported. */
  private readonly _browserSaved = signal<Loadout[]>(readBrowserSaved());
  readonly browserSavedCount = computed(() => this._browserSaved().length);

  private loaded: Promise<void> | null = null;

  /** Loads once; later calls share the same request. Guards await this before reading. */
  ensureLoaded(): Promise<void> {
    this.loaded ??= this.reload();
    return this.loaded;
  }

  /** Forgets the signed-out user's loadouts so the next account starts clean. */
  reset(): void {
    this._loadouts.set([]);
    this._state.set('loading');
    this.loaded = null;
  }

  async reload(): Promise<void> {
    this._state.set('loading');
    try {
      this._loadouts.set(await firstValueFrom(this.api.list()));
      this._state.set('ready');
    } catch {
      this._state.set('error');
      this.loaded = null; // allow a retry
    }
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
  /** Creates when `id` is omitted, otherwise replaces that loadout. */
  async save(draft: LoadoutDraft, id?: string): Promise<SaveResult> {
    try {
      const saved = await firstValueFrom(id ? this.api.update(id, draft) : this.api.create(draft));
      this.upsert(saved);
      return { ok: true, loadout: saved };
    } catch (err) {
      const limit = err instanceof HttpErrorResponse && err.status === 409;
      return {
        ok: false,
        reason: limit ? 'limit' : 'error',
        message: problemDetail(err) ?? 'Could not save the loadout.',
      };
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.delete(id));
      this._loadouts.update((all) => all.filter((l) => l.id !== id));
      return true;
    } catch {
      return false;
    }
  }

  /** Optimistic: the star flips immediately and reverts if the server rejects it. */
  async toggleFav(id: string): Promise<void> {
    const current = this.byId(id);
    if (!current) return;
    this.upsert({ ...current, fav: !current.fav });
    try {
      this.upsert(await firstValueFrom(this.api.setFavorite(id, !current.fav)));
    } catch {
      this.upsert(current);
    }
  }

  /** Creates the sample loadouts on the server. */
  async seedDemo(): Promise<void> {
    for (const demo of demoLoadouts()) {
      const result = await this.save(demo);
      if (result.ok && demo.fav) await this.toggleFav(result.loadout.id);
    }
  }

  /**
   * Uploads loadouts that were saved in this browser before the API existed, then removes them
   * from browser storage. Returns how many were imported; any that fail (e.g. a frame already
   * at the cap) stay in the browser so nothing is lost.
   */
  async importBrowserSaved(): Promise<number> {
    const remaining: Loadout[] = [];
    let imported = 0;
    for (const local of this._browserSaved()) {
      const result = await this.save(local);
      if (!result.ok) {
        remaining.push(local);
        continue;
      }
      imported++;
      if (local.fav) await this.toggleFav(result.loadout.id);
    }
    writeBrowserSaved(remaining);
    this._browserSaved.set(remaining);
    return imported;
  }

  private upsert(loadout: Loadout): void {
    this._loadouts.update((all) =>
      all.some((l) => l.id === loadout.id)
        ? all.map((l) => (l.id === loadout.id ? loadout : l))
        : [loadout, ...all],
    );
  }
}

// ── Browser storage from before the API (read-only, for import) ──
const STORAGE_KEY_V2 = 'warframe-runway.loadouts.v2';
const STORAGE_KEY_V1 = 'warframe-runway.loadouts.v1';

/** v1 stored a 4-color summary and could omit attachments/colorState. */
interface LoadoutV1 extends Omit<Loadout, 'attachments' | 'colorState'> {
  colors?: string[];
  attachments?: Loadout['attachments'];
  colorState?: Loadout['colorState'];
}

function readBrowserSaved(): Loadout[] {
  try {
    const v2 = localStorage.getItem(STORAGE_KEY_V2);
    if (v2) return JSON.parse(v2) as Loadout[];
    const v1 = localStorage.getItem(STORAGE_KEY_V1);
    return v1 ? migrateV1(JSON.parse(v1) as LoadoutV1[]) : [];
  } catch {
    return [];
  }
}

function writeBrowserSaved(loadouts: Loadout[]): void {
  localStorage.removeItem(STORAGE_KEY_V1);
  if (loadouts.length) localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(loadouts));
  else localStorage.removeItem(STORAGE_KEY_V2);
}

function migrateV1(items: LoadoutV1[]): Loadout[] {
  return items.map(({ colors, attachments, colorState, ...rest }) => ({
    ...rest,
    attachments: attachments ?? emptyAttachments(),
    colorState: colorState ?? colorStateFromSummary(colors ?? []),
  }));
}
