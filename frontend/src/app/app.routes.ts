import { Routes } from '@angular/router';
import { Collection } from './features/collection/collection';
import { Builder } from './features/builder/builder';
import { loadoutExistsGuard, unsavedChangesGuard } from './features/builder/builder.guards';
import { authGuard } from './core/auth.guard';

/** `/builder` opens a blank draft; `/builder/:id` edits an existing loadout. */
export const routes: Routes = [
  { path: '', component: Collection },
  {
    path: 'builder',
    component: Builder,
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'builder/:id',
    component: Builder,
    canActivate: [authGuard, loadoutExistsGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  { path: '**', redirectTo: '' },
];
