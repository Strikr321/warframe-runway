import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { emptyAttachments } from '../models/loadout.model';
import { defaultColorState, summaryColors } from '../../data/channels.data';
import { LoadoutService } from './loadout.service';

const API = '/api/loadouts';

/** A loadout as the API returns it. */
function dto(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    frame: 'Volt',
    name: `L ${id}`,
    creator: 'Tenno',
    favorite: false,
    attachments: emptyAttachments(),
    colorState: defaultColorState(),
    createdAt: '2026-10-19T10:00:00Z',
    updatedAt: '2026-10-19T12:00:00Z',
    ...overrides,
  };
}

const draft = () => ({
  frame: 'Volt',
  name: 'Storm',
  creator: 'Tenno',
  attachments: emptyAttachments(),
  colorState: defaultColorState(),
});

describe('LoadoutService', () => {
  let service: LoadoutService;
  let http: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LoadoutService);
    http = TestBed.inject(HttpTestingController);
  }

  /** Loads the service with `items` from the API. */
  async function loadWith(items: ReturnType<typeof dto>[]) {
    const done = service.ensureLoaded();
    http.expectOne(API).flush(items);
    await done;
  }

  beforeEach(() => {
    localStorage.clear();
    setup();
  });
  afterEach(() => http.verify());

  it('loads once and maps the API shape to the app model', async () => {
    await loadWith([dto('a', { favorite: true })]);
    await service.ensureLoaded(); // no second request

    expect(service.state()).toBe('ready');
    const [a] = service.loadouts();
    expect(a.fav).toBe(true);
    expect(a.edited).toBe('2026-10-19T12:00:00Z');
  });

  it('reports an error state and allows a retry', async () => {
    const first = service.ensureLoaded();
    http.expectOne(API).flush(null, { status: 0, statusText: 'Unknown Error' });
    await first;
    expect(service.state()).toBe('error');

    const retry = service.ensureLoaded();
    http.expectOne(API).flush([dto('a')]);
    await retry;
    expect(service.state()).toBe('ready');
  });

  it('creates when no id is given and adds the server result', async () => {
    await loadWith([]);
    const saving = service.save(draft());
    const req = http.expectOne({ method: 'POST', url: API });
    expect(req.request.body).toEqual(draft());
    req.flush(dto('new', { name: 'Storm' }));

    const result = await saving;
    expect(result.ok).toBe(true);
    expect(service.byId('new')?.name).toBe('Storm');
  });

  it('updates in place when an id is given', async () => {
    await loadWith([dto('a')]);
    const saving = service.save({ ...draft(), name: 'Renamed' }, 'a');
    http.expectOne({ method: 'PUT', url: `${API}/a` }).flush(dto('a', { name: 'Renamed' }));
    await saving;

    expect(service.loadouts()).toHaveLength(1);
    expect(service.byId('a')?.name).toBe('Renamed');
  });

  it('turns a 409 into a limit result with the server message', async () => {
    await loadWith([]);
    const saving = service.save(draft());
    http
      .expectOne(API)
      .flush(
        { title: 'Loadout limit reached', detail: 'Volt already has 6 loadouts' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(await saving).toEqual({
      ok: false,
      reason: 'limit',
      message: 'Volt already has 6 loadouts',
    });
  });

  it('flips a favorite immediately and reverts if the server fails', async () => {
    await loadWith([dto('a')]);
    const toggling = service.toggleFav('a');
    expect(service.byId('a')?.fav).toBe(true); // optimistic

    http.expectOne(`${API}/a/favorite`).flush(null, { status: 500, statusText: 'Server Error' });
    await toggling;
    expect(service.byId('a')?.fav).toBe(false);
  });

  it('removes a loadout after the server confirms the delete', async () => {
    await loadWith([dto('a')]);
    const deleting = service.delete('a');
    http
      .expectOne({ method: 'DELETE', url: `${API}/a` })
      .flush(null, { status: 204, statusText: '' });

    expect(await deleting).toBe(true);
    expect(service.byId('a')).toBeUndefined();
  });

  describe('importing loadouts saved in the browser', () => {
    function withBrowserSaved(key: string, items: unknown[]) {
      TestBed.resetTestingModule();
      localStorage.setItem(key, JSON.stringify(items));
      setup();
    }

    it('reads v1 storage, keeping its colors, and clears it after import', async () => {
      withBrowserSaved('warframe-runway.loadouts.v1', [
        {
          id: 'old',
          frame: 'Volt',
          name: 'Old',
          creator: 'Tenno',
          fav: false,
          edited: '',
          colors: ['#111111', '#222222', '#333333', '#444444'],
        },
      ]);
      expect(service.browserSavedCount()).toBe(1);

      const importing = service.importBrowserSaved();
      const req = http.expectOne({ method: 'POST', url: API });
      expect(summaryColors(req.request.body.colorState)).toEqual([
        '#111111',
        '#222222',
        '#333333',
        '#444444',
      ]);
      req.flush(dto('server-id'));

      expect(await importing).toBe(1);
      expect(service.browserSavedCount()).toBe(0);
      expect(localStorage.getItem('warframe-runway.loadouts.v1')).toBeNull();
    });

    it('keeps loadouts the server rejects so nothing is lost', async () => {
      const local = {
        id: 'x',
        frame: 'Volt',
        name: 'X',
        creator: 'Tenno',
        fav: false,
        edited: '',
        attachments: emptyAttachments(),
        colorState: defaultColorState(),
      };
      withBrowserSaved('warframe-runway.loadouts.v2', [local]);

      const importing = service.importBrowserSaved();
      http.expectOne(API).flush({ detail: 'full' }, { status: 409, statusText: 'Conflict' });

      expect(await importing).toBe(0);
      expect(service.browserSavedCount()).toBe(1);
      expect(JSON.parse(localStorage.getItem('warframe-runway.loadouts.v2')!)).toHaveLength(1);
    });
  });
});
