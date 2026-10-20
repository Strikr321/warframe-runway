import { TestBed } from '@angular/core/testing';
import { Loadout, MAX_LOADOUTS_PER_FRAME } from '../models/loadout.model';
import { LoadoutService } from './loadout.service';

const STORAGE_KEY = 'warframe-runway.loadouts.v1';

function loadout(id: string, frame = 'Volt'): Loadout {
  return { id, frame, name: `L ${id}`, creator: 'Tenno', colors: [], fav: false, edited: '' };
}

describe('LoadoutService', () => {
  let service: LoadoutService;

  beforeEach(() => {
    localStorage.clear();
    service = TestBed.inject(LoadoutService);
  });

  it('creates a new loadout and stamps the edit time', () => {
    expect(service.save(loadout('a'))).toBe(true);
    const saved = service.byId('a');
    expect(saved?.edited).not.toBe('');
    expect(service.byFrame('Volt')).toHaveLength(1);
  });

  it('updates an existing loadout in place', () => {
    service.save(loadout('a'));
    service.save({ ...loadout('a'), name: 'Renamed' });
    expect(service.loadouts()).toHaveLength(1);
    expect(service.byId('a')?.name).toBe('Renamed');
  });

  it(`refuses a new loadout past ${MAX_LOADOUTS_PER_FRAME} per frame`, () => {
    for (let i = 0; i < MAX_LOADOUTS_PER_FRAME; i++) service.save(loadout(`v${i}`));
    expect(service.canAddLoadout('Volt')).toBe(false);
    expect(service.save(loadout('extra'))).toBe(false);
    expect(service.byFrame('Volt')).toHaveLength(MAX_LOADOUTS_PER_FRAME);
  });

  it('still allows editing when a frame is at the cap', () => {
    for (let i = 0; i < MAX_LOADOUTS_PER_FRAME; i++) service.save(loadout(`v${i}`));
    expect(service.save({ ...loadout('v0'), name: 'Edited' })).toBe(true);
  });

  it('toggles favorites and deletes', () => {
    service.save(loadout('a'));
    service.toggleFav('a');
    expect(service.byId('a')?.fav).toBe(true);
    service.delete('a');
    expect(service.byId('a')).toBeUndefined();
  });

  it('persists changes to localStorage', () => {
    service.save(loadout('a'));
    TestBed.tick();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Loadout[];
    expect(stored.map((l) => l.id)).toEqual(['a']);
  });

  it('starts empty when stored data is corrupt', () => {
    TestBed.resetTestingModule();
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(TestBed.inject(LoadoutService).loadouts()).toEqual([]);
  });
});
