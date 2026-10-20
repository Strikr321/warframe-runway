import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ToastService } from '../shared/toast/toast.service';

/** Pages that need an account send signed-out visitors back to the Collection's sign-in prompt. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const router = inject(Router);
  await auth.ensureChecked();
  if (auth.signedIn()) return true;
  toast.show('Sign in to create and edit loadouts');
  return router.createUrlTree(['/']);
};
