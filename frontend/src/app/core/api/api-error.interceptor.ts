import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../../shared/toast/toast.service';

/**
 * Shows a toast for failures no caller can do anything about (server unreachable, 5xx).
 * 4xx responses are left to the caller, which knows what they mean (e.g. 409 = loadout cap).
 * The error is always re-thrown so callers can still react.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && req.url.startsWith('/api/')) {
        if (err.status === 0) toast.show("Can't reach the server. Is the API running?");
        else if (err.status >= 500) toast.show('Something went wrong on the server');
      }
      return throwError(() => err);
    }),
  );
};

/** The `detail` of an RFC 9457 problem response, if the error carries one. */
export function problemDetail(err: unknown): string | null {
  if (err instanceof HttpErrorResponse && typeof err.error?.detail === 'string') {
    return err.error.detail;
  }
  return null;
}
