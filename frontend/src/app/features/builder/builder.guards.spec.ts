import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { LoadoutService } from '../../core/services/loadout.service';
import { ToastService } from '../../shared/toast/toast.service';
import { HasUnsavedChanges, loadoutExistsGuard, unsavedChangesGuard } from './builder.guards';

describe('builder guards', () => {
  const state = {} as RouterStateSnapshot;
  const routeWithId = (id: string) =>
    ({ paramMap: convertToParamMap({ id }) }) as ActivatedRouteSnapshot;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  describe('loadoutExistsGuard', () => {
    it('allows a loadout that exists', () => {
      TestBed.inject(LoadoutService).seedDemo();
      const result = TestBed.runInInjectionContext(() =>
        loadoutExistsGuard(routeWithId('l1'), state),
      );
      expect(result).toBe(true);
    });

    it('redirects an unknown id to the Collection with a toast', () => {
      const result = TestBed.runInInjectionContext(() =>
        loadoutExistsGuard(routeWithId('missing'), state),
      );
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
