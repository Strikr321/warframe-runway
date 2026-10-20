import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export type AuthStatus = 'unknown' | 'signed-in' | 'signed-out';

/**
 * Who is signed in. The API runs the Google sign-in and keeps the session in an HttpOnly cookie,
 * so the app never handles tokens: it asks `/api/me` and starts sign-in by navigating to the API.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private readonly _user = signal<CurrentUser | null>(null);
  readonly user = this._user.asReadonly();

  private readonly _status = signal<AuthStatus>('unknown');
  readonly status = this._status.asReadonly();
  readonly signedIn = computed(() => this._status() === 'signed-in');

  private checked: Promise<void> | null = null;

  /** Resolves once we know whether there is a session. Later calls share the first check. */
  ensureChecked(): Promise<void> {
    this.checked ??= this.check();
    return this.checked;
  }

  private async check(): Promise<void> {
    try {
      this._user.set(await firstValueFrom(this.http.get<CurrentUser>('/api/me')));
      this._status.set('signed-in');
    } catch (err) {
      this._user.set(null);
      this._status.set('signed-out');
      // Anything other than "no session" (e.g. API down) is worth re-checking next time.
      if (!(err instanceof HttpErrorResponse && err.status === 401)) this.checked = null;
    }
  }

  /** Full-page navigation: the API redirects to Google and back to the app afterwards. */
  signIn(): void {
    window.location.assign('/oauth2/authorization/google');
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/logout', null));
    } finally {
      this.markSignedOut();
    }
  }

  /** Called when the API says the session is gone (sign-out, or expiry mid-use). */
  markSignedOut(): void {
    this._user.set(null);
    this._status.set('signed-out');
    this.checked = Promise.resolve();
  }
}
