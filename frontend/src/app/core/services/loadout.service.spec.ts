import { TestBed } from '@angular/core/testing';
import { Loadout, MAX_LOADOUTS_PER_FRAME, emptyAttachments } from '../models/loadout.model';
import { defaultColorState, summaryColors } from '../../data/channels.data';
import { LoadoutService } from './loadout.service';

const STORAGE_KEY = 'warframe-runway.loadouts.v2';
const LEGACY_KEY_V1 = 'warframe-runway.loadouts.v1';

function loadout(id: string, frame = 'Volt'): Loadout {
  return {
    id,
    frame,
    name: `L ${id}`,
    creator: 'Tenno',
    fav: false,
    edited: '',
    attachments: emptyAttachments(),
    colorState: defaultColorState(),
  };
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

  describe('v1 storage migration', () => {
    beforeEach(() => TestBed.resetTestingModule());

    it('fills in color state from the old 4-color summary and moves to the v2 key', () => {
      const v1 = [
        {
          id: 'old',
          frame: 'Volt',
          name: 'Old',
          creator: 'Tenno',
          fav: true,
          edited: '',
          colors: ['#111111', '#222222', '#333333', '#444444'],
        },
      ];
      localStorage.setItem(LEGACY_KEY_V1, JSON.stringify(v1));

      const [migrated] = TestBed.inject(LoadoutService).loadouts();
      expect(summaryColors(migrated.colorState)).toEqual([
        '#111111',
        '#222222',
        '#333333',
        '#444444',
      ]);
      expect(migrated.attachments).toEqual(emptyAttachments());
      expect(migrated).not.toHaveProperty('colors');
      expect(localStorage.getItem(LEGACY_KEY_V1)).toBeNull();
    });

    it('keeps full color state that v1 loadouts already had', () => {
      const colorState = defaultColorState();
      colorState.primary.hex = '#abcdef';
      localStorage.setItem(
        LEGACY_KEY_V1,
        JSON.stringify([{ ...loadout('a'), colors: ['#000000'], colorState }]),
      );
      expect(TestBed.inject(LoadoutService).byId('a')?.colorState.primary.hex).toBe('#abcdef');
    });
  });

  it('loads demo loadouts with full color state, so saving them keeps their colors', () => {
    service.seedDemo();
    const volt = service.byId('l1')!;
    expect(summaryColors(volt.colorState)).toEqual(['#e8641a', '#3080c8', '#a0a0a0', '#f0c050']);
  });
});
