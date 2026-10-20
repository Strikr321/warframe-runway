import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../shared/toast/toast.service';
import { apiErrorInterceptor, problemDetail } from './api-error.interceptor';

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let toast: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
  });
  afterEach(() => backend.verify());

  async function fail(url: string, status: number, body: object | null = null) {
    const request = firstValueFrom(http.get(url));
    backend.expectOne(url).flush(body, { status, statusText: 'x' });
    return request.catch((e: unknown) => e);
  }

  it('toasts when the API is unreachable', async () => {
    await fail('/api/loadouts', 0);
    expect(toast.message()).toContain("Can't reach the server");
  });

  it('toasts on server errors', async () => {
    await fail('/api/loadouts', 503);
    expect(toast.message()).toContain('went wrong');
  });

  it('leaves client errors to the caller and still re-throws', async () => {
    const err = await fail('/api/loadouts', 409, { detail: 'Volt already has 6 loadouts' });
    expect(toast.message()).toBe('');
    expect(problemDetail(err)).toBe('Volt already has 6 loadouts');
  });

  it('ignores requests outside the API', async () => {
    await fail('https://example.com/data.json', 500);
    expect(toast.message()).toBe('');
  });
});
