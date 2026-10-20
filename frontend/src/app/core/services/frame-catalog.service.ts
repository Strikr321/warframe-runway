import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FALLBACK_FRAMES } from '../../data/frames-fallback.data';

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
 * The list of Warframes, sourced live from WFCD's community `warframe-items`
 * dataset so new frames appear without code changes.
 *
 * The source file is several MB, so only name + image are kept and cached in
 * localStorage for a day. On fetch failure it falls back to the last cache,
 * then to FALLBACK_FRAMES.
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

  /** Frame names, sorted. */
  frames = signal<string[]>(this.cached?.infos.map(i => i.name) ?? FALLBACK_FRAMES);
  /** Frame names with portrait image URLs. */
  frameInfos = signal<FrameInfo[]>(this.cached?.infos ?? []);

  loading = signal(false);
  /** Caption text, e.g. "refreshed 3h ago". */
  status = signal<string>(this.cached ? this.describeAge(this.cached.fetchedAt) : 'Using built-in frame list');
  lastError = signal<string | null>(null);

  constructor() {
    const isStale = !this.cached || (Date.now() - this.cached.fetchedAt) > FrameCatalogService.MAX_AGE_MS;
    if (isStale) this.refresh();
  }

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

  /** Variants treated as their base frame that the data has no flag for (unlike Primes or Necramechs). */
  private static readonly EXCLUDED_NAMES = new Set(['Excalibur Umbra']);

  private onFetchSuccess(raw: RawWfcdItem[]) {
    const seen = new Set<string>();
    const infos: FrameInfo[] = [];

    for (const item of raw) {
      if (item.isPrime) continue;
      // Warframes are "Suits"; this excludes Necramechs ("MechSuits") and the uncategorized Helminth entry.
      if (item.productCategory !== 'Suits') continue;
      if (FrameCatalogService.EXCLUDED_NAMES.has(item.name)) continue;

      // "X & Y" entries (Sirius & Orion) are two separately colored frames, so split them.
      // Dedup on the split names so "Orion & Sirius" collapses into the same two entries.
      const names = item.name.includes(' & ') ? item.name.split(' & ').map(n => n.trim()) : [item.name];

      for (const name of names) {
        if (seen.has(name)) continue;
        seen.add(name);
        infos.push({
          name,
          // Split pairs share the single portrait the dataset provides.
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
      // Storage full or unavailable: not fatal, we just re-fetch next visit.
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
