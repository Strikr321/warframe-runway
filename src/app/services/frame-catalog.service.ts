import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FRAMES as HARDCODED_FALLBACK } from '../models/loadout.model';

export interface FrameInfo {
  name: string;
  image: string;       // full CDN URL — cdn.warframestat.us/img/<file>
  releaseDate?: string;
}

interface CacheShape {
  fetchedAt: number;
  infos: FrameInfo[];
}

/**
 * FRAME CATALOG — live data instead of a hand-maintained array.
 * =================================================================
 * Backed by WFCD's community-maintained `warframe-items` dataset
 * (the same project behind warframestat.us), fetched straight from
 * GitHub's raw file host. This is genuinely live: it's what proved
 * "Sirius & Orion" (added June 17, 2026) shows up automatically here
 * without anyone touching this codebase.
 *
 * Caching strategy: the raw source file is several MB (it carries
 * full ability/stat data for every frame, not just names), so
 * fetching it on every page load would be wasteful. Instead: fetch
 * once, keep only what we need (name + image), cache THAT slim
 * result in localStorage with a timestamp, and only re-fetch once
 * the cache is more than a day old. New content shows up within a
 * day of release with zero manual work — which is the whole point.
 *
 * If the fetch ever fails (offline, source moved, CORS changes),
 * this quietly falls back to the last successful cache, or to the
 * original hardcoded FRAMES list as a last resort — the app never
 * breaks because an external, unowned data source hiccuped.
 */
@Injectable({ providedIn: 'root' })
export class FrameCatalogService {
  private static readonly CACHE_KEY = 'warframe-runway.frameCatalog.v2';
  private static readonly MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day
  private static readonly SOURCE_URL =
    'https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Warframes.json';
  private static readonly IMG_BASE = 'https://cdn.warframestat.us/img/';

  private http = inject(HttpClient);

  private readonly cached = this.readCache();

  /** Plain frame names — drop-in replacement for the old hardcoded FRAMES array. */
  frames = signal<string[]>(this.cached?.infos.map(i => i.name) ?? HARDCODED_FALLBACK);
  /** Name + portrait image, for anywhere that wants to show a picture too. */
  frameInfos = signal<FrameInfo[]>(this.cached?.infos ?? []);

  loading = signal(false);
  /** Human-readable status for a small "last refreshed" caption in the UI. */
  status = signal<string>(this.cached ? this.describeAge(this.cached.fetchedAt) : 'Using built-in frame list');
  lastError = signal<string | null>(null);

  constructor() {
    const isStale = !this.cached || (Date.now() - this.cached.fetchedAt) > FrameCatalogService.MAX_AGE_MS;
    if (isStale) this.refresh();
  }

  /** Force a refresh right now — exposed for a manual "Refresh" button if wanted. */
  refresh(): void {
    this.loading.set(true);
    this.http.get<RawWfcdItem[]>(FrameCatalogService.SOURCE_URL).subscribe({
      next: (raw) => this.onFetchSuccess(raw),
      error: () => {
        this.loading.set(false);
        this.lastError.set('Could not reach the live frame catalog — using cached/local data.');
      },
    });
  }

  /**
   * Names with no generic structural signal to exclude them by — just
   * variant/alternate versions of a base frame that this app treats
   * as "the same frame" (Excalibur Umbra -> Excalibur). Unlike Primes
   * (which have a real `isPrime` flag) or Necramechs (a real
   * `productCategory` of "MechSuits"), there's nothing in the raw data
   * that distinguishes these, so they're excluded by exact name here.
   */
  private static readonly EXCLUDED_NAMES = new Set(['Excalibur Umbra']);

  private onFetchSuccess(raw: RawWfcdItem[]) {
    const seen = new Set<string>();
    const infos: FrameInfo[] = [];

    for (const item of raw) {
      if (item.isPrime) continue;
      // "Suits" is what actual Warframes are categorized as in this
      // dataset — Necramechs (Bonewidow, Voidrig) are "MechSuits", and
      // a stray "Helminth" entry has no category at all. Filtering to
      // Suits excludes both generically, rather than guessing names.
      if (item.productCategory !== 'Suits') continue;
      if (FrameCatalogService.EXCLUDED_NAMES.has(item.name)) continue;

      // Sirius & Orion is one Warframe slot but two separately-built,
      // separately-colored frames — split "X & Y" into two entries so
      // each is pickable on its own, the way this app treats every
      // other frame. Checking the SPLIT names (not the raw combined
      // name) against `seen` is what naturally collapses "Sirius &
      // Orion" and its duplicate "Orion & Sirius" down to just one
      // "Sirius" and one "Orion", however many raw rows reference them.
      const names = item.name.includes(' & ') ? item.name.split(' & ').map(n => n.trim()) : [item.name];

      for (const name of names) {
        if (seen.has(name)) continue;
        seen.add(name);
        infos.push({
          name,
          // Both halves of a split combo share the one portrait this
          // dataset provides — there's no separate per-son image data.
          image: FrameCatalogService.IMG_BASE + (item.imageName ?? ''),
          releaseDate: item.releaseDate,
        });
      }
    }
    infos.sort((a, b) => a.name.localeCompare(b.name));

    this.frameInfos.set(infos);
    this.frames.set(infos.map(i => i.name));
    this.writeCache({ fetchedAt: Date.now(), infos });
    this.loading.set(false);
    this.lastError.set(null);
    this.status.set(`${infos.length} frames — refreshed just now`);
  }

  private describeAge(fetchedAt: number): string {
    const mins = Math.round((Date.now() - fetchedAt) / 60000);
    if (mins < 1) return 'refreshed just now';
    if (mins < 60) return `refreshed ${mins} min ago`;
    const hours = Math.round(mins / 60);
    return `refreshed ${hours}h ago`;
  }

  private readCache(): CacheShape | null {
    try {
      const raw = localStorage.getItem(FrameCatalogService.CACHE_KEY);
      return raw ? (JSON.parse(raw) as CacheShape) : null;
    } catch {
      return null;
    }
  }

  private writeCache(data: CacheShape): void {
    try {
      localStorage.setItem(FrameCatalogService.CACHE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable — not fatal, just means we re-fetch next visit.
    }
  }
}

interface RawWfcdItem {
  name: string;
  isPrime?: boolean;
  imageName?: string;
  releaseDate?: string;
  productCategory?: string;
}
