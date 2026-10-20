import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FALLBACK_FRAMES } from '../../data/frames-fallback.data';
import { FrameCatalogService } from './frame-catalog.service';

const SOURCE_URL =
  'https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Warframes.json';
const CACHE_KEY = 'warframe-runway.frameCatalog.v2';

describe('FrameCatalogService', () => {
  let http: HttpTestingController;

  function create(): FrameCatalogService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(FrameCatalogService);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => http.verify());

  it('starts from the fallback list and fetches the live catalog', () => {
    const service = create();
    expect(service.frames()).toEqual(FALLBACK_FRAMES);
    expect(service.loading()).toBe(true);
    http.expectOne(SOURCE_URL);
  });

  it('keeps only base Warframes, splits paired frames, and sorts', () => {
    const service = create();
    http
      .expectOne(SOURCE_URL)
      .flush([
        { name: 'Volt', productCategory: 'Suits', imageName: 'volt.png' },
        { name: 'Volt Prime', productCategory: 'Suits', isPrime: true },
        { name: 'Bonewidow', productCategory: 'MechSuits' },
        { name: 'Helminth' },
        { name: 'Excalibur Umbra', productCategory: 'Suits' },
        { name: 'Sirius & Orion', productCategory: 'Suits', imageName: 'so.png' },
        { name: 'Orion & Sirius', productCategory: 'Suits', imageName: 'so.png' },
        { name: 'Ash', productCategory: 'Suits', imageName: 'ash.png' },
      ]);

    expect(service.frames()).toEqual(['Ash', 'Orion', 'Sirius', 'Volt']);
    expect(service.frameInfos()[0].image).toBe('https://cdn.warframestat.us/img/ash.png');
    expect(service.loading()).toBe(false);
  });

  it('caches the slim result so the next visit skips the fetch', () => {
    create();
    http
      .expectOne(SOURCE_URL)
      .flush([{ name: 'Ash', productCategory: 'Suits', imageName: 'ash.png' }]);
    TestBed.resetTestingModule();

    const second = create();
    http.expectNone(SOURCE_URL);
    expect(second.frames()).toEqual(['Ash']);
  });

  it('re-fetches once the cache is older than a day', () => {
    const stale = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: stale, infos: [{ name: 'Ash', image: '' }] }),
    );
    create();
    http.expectOne(SOURCE_URL);
  });

  it('keeps the current list and reports an error when the fetch fails', () => {
    const service = create();
    http.expectOne(SOURCE_URL).error(new ProgressEvent('offline'));
    expect(service.frames()).toEqual(FALLBACK_FRAMES);
    expect(service.lastError()).toContain('Could not reach');
  });
});
