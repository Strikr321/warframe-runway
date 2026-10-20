import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LoadoutService } from '../../core/services/loadout.service';
import { ToastService } from '../../shared/toast/toast.service';

/** Something that can report unsaved edits before the router leaves it. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** `/builder/:id` for a deleted or unknown loadout goes back to the Collection instead of opening a blank draft. */
export const loadoutExistsGuard: CanActivateFn = async (route) => {
  const store = inject(LoadoutService);
  const toast = inject(ToastService);
  const router = inject(Router);
  const auth = inject(AuthService);
  // authGuard handles signed-out visitors; don't hit the API (and a 401) for them.
  await auth.ensureChecked();
  if (!auth.signedIn()) return false;
  await store.ensureLoaded();

  const id = route.paramMap.get('id');
  if (id && store.byId(id)) return true;
  toast.show(
    store.state() === 'error'
      ? "Can't load that loadout right now"
      : 'That loadout no longer exists',
  );
  return router.createUrlTree(['/']);
};

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() ||
  window.confirm('You have unsaved changes. Leave without saving?');
