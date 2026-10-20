import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { emptyAttachments } from '../../core/models/loadout.model';
import { defaultColorState } from '../../data/channels.data';
import { ToastService } from '../../shared/toast/toast.service';
import { HasUnsavedChanges, loadoutExistsGuard, unsavedChangesGuard } from './builder.guards';

describe('builder guards', () => {
  const state = {} as RouterStateSnapshot;
  const routeWithId = (id: string) =>
    ({ paramMap: convertToParamMap({ id }) }) as ActivatedRouteSnapshot;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  /** Runs the guard while the API answers the initial list request with `items`. */
  async function runExistsGuard(id: string, items: unknown[]) {
    const result = TestBed.runInInjectionContext(() => loadoutExistsGuard(routeWithId(id), state));
    TestBed.inject(HttpTestingController).expectOne('/api/loadouts').flush(items);
    return result;
  }

  describe('loadoutExistsGuard', () => {
    it('allows a loadout that exists', async () => {
      const loadout = {
        id: 'l1',
        frame: 'Volt',
        name: 'Storm',
        creator: 'Tenno',
        favorite: false,
        attachments: emptyAttachments(),
        colorState: defaultColorState(),
        createdAt: '',
        updatedAt: '',
      };
      expect(await runExistsGuard('l1', [loadout])).toBe(true);
    });

    it('redirects an unknown id to the Collection with a toast', async () => {
      const result = await runExistsGuard('missing', []);
      const router = TestBed.inject(Router);
      expect(router.serializeUrl(result as UrlTree)).toBe('/');
      expect(TestBed.inject(ToastService).message()).toContain('no longer exists');
    });
  });

  describe('unsavedChangesGuard', () => {
    const component = (dirty: boolean): HasUnsavedChanges => ({ hasUnsavedChanges: () => dirty });
    const run = (dirty: boolean) =>
      TestBed.runInInjectionContext(() =>
        unsavedChangesGuard(component(dirty), {} as ActivatedRouteSnapshot, state, state),
      );

    afterEach(() => vi.restoreAllMocks());

    it('lets a clean draft leave without asking', () => {
      const confirm = vi.spyOn(window, 'confirm');
      expect(run(false)).toBe(true);
      expect(confirm).not.toHaveBeenCalled();
    });

    it('asks before discarding edits and respects the answer', () => {
      vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
      expect(run(true)).toBe(false);
      expect(run(true)).toBe(true);
    });
  });
});
