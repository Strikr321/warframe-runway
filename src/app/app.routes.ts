import { Routes } from '@angular/router';
import { Collection } from './pages/collection/collection';
import { Builder } from './pages/builder/builder';

/**
 * THE ROUTE TABLE — the map of your app.
 * Angular looks at the browser URL and renders the matching
 * component inside <router-outlet> (see app.html).
 */
export const routes: Routes = [
  { path: '', component: Collection },        // yoursite.com/       → Collection page
  { path: 'builder', component: Builder },    // yoursite.com/builder → Builder page
  { path: '**', redirectTo: '' },             // any unknown URL     → back home
];
