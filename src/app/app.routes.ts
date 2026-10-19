import { Routes } from '@angular/router';
import { Collection } from './features/collection/collection';
import { Builder } from './features/builder/builder';

/**
 * THE ROUTE TABLE.
 * Two routes point at the same Builder component: with no :id it's a
 * blank draft, with one it loads that loadout. Builder reads the
 * difference itself via ActivatedRoute — see builder.ts.
 */
export const routes: Routes = [
  { path: '', component: Collection },
  { path: 'builder', component: Builder },
  { path: 'builder/:id', component: Builder },
  { path: '**', redirectTo: '' },
];
