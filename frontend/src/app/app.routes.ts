import { Routes } from '@angular/router';
import { Collection } from './features/collection/collection';
import { Builder } from './features/builder/builder';

/** `/builder` opens a blank draft; `/builder/:id` edits an existing loadout. */
export const routes: Routes = [
  { path: '', component: Collection },
  { path: 'builder', component: Builder },
  { path: 'builder/:id', component: Builder },
  { path: '**', redirectTo: '' },
];
