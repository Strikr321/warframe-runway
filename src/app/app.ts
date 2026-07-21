import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

/**
 * ROOT COMPONENT — the shell of the app.
 * The header + nav live here so they appear on EVERY page.
 * The page itself is swapped in and out by <router-outlet>.
 *
 * Anatomy of a component:
 *  - this .ts file  = the logic (a TypeScript class)
 *  - app.html       = the template (what renders)
 *  - app.css        = styles scoped to ONLY this component
 */
@Component({
  selector: 'app-root',                                   // the tag name used in index.html
  imports: [RouterOutlet, RouterLink, RouterLinkActive],  // what this template is allowed to use
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
