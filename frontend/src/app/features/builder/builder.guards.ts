import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { LoadoutService } from '../../core/services/loadout.service';
import { ToastService } from '../../shared/toast/toast.service';

/** Something that can report unsaved edits before the router leaves it. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** `/builder/:id` for a deleted or unknown loadout goes back to the Collection instead of opening a blank draft. */
export const loadoutExistsGuard: CanActivateFn = (route) => {
  const id = route.paramMap.get('id');
  if (id && inject(LoadoutService).byId(id)) return true;
  inject(ToastService).show('That loadout no longer exists');
  return inject(Router).createUrlTree(['/']);
};

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() ||
  window.confirm('You have unsaved changes. Leave without saving?');
