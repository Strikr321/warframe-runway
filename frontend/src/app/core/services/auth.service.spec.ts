import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  const me = { id: 'u1', email: 'a@example.com', name: 'A', avatarUrl: null };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('is signed in when /api/me answers, and checks only once', async () => {
    const check = auth.ensureChecked();
    http.expectOne('/api/me').flush(me);
    await check;
    await auth.ensureChecked();

    expect(auth.status()).toBe('signed-in');
    expect(auth.user()?.name).toBe('A');
  });

  it('is signed out on 401 and does not ask again', async () => {
    const check = auth.ensureChecked();
    http.expectOne('/api/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await check;
    await auth.ensureChecked();

    expect(auth.status()).toBe('signed-out');
  });

  it('re-checks after a server error instead of trusting it', async () => {
    const first = auth.ensureChecked();
    http.expectOne('/api/me').flush(null, { status: 503, statusText: 'Unavailable' });
    await first;

    const second = auth.ensureChecked();
    http.expectOne('/api/me').flush(me);
    await second;
    expect(auth.signedIn()).toBe(true);
  });

  it('signs out through the API and forgets the user', async () => {
    const check = auth.ensureChecked();
    http.expectOne('/api/me').flush(me);
    await check;

    const signingOut = auth.signOut();
    http
      .expectOne({ method: 'POST', url: '/api/logout' })
      .flush(null, { status: 204, statusText: '' });
    await signingOut;

    expect(auth.user()).toBeNull();
    expect(auth.status()).toBe('signed-out');
  });
});
