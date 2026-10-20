import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { ToastService } from '../shared/toast/toast.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const run = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  it('lets a signed-in user through', async () => {
    const result = run();
    http
      .expectOne('/api/me')
      .flush({ id: 'u1', email: 'a@example.com', name: 'A', avatarUrl: null });
    expect(await result).toBe(true);
  });

  it('sends a signed-out visitor to the Collection with a prompt', async () => {
    const result = run();
    http.expectOne('/api/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(TestBed.inject(Router).serializeUrl((await result) as UrlTree)).toBe('/');
    expect(TestBed.inject(ToastService).message()).toContain('Sign in');
  });
});
