import { Component, inject } from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { Toast } from './shared/toast/toast';
import { ToastService } from './shared/toast/toast.service';
import { AuthService } from './core/services/auth.service';
import { LoadoutService } from './core/services/loadout.service';

/** App shell: shared header with nav and account menu, the routed page, and the global toast. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Toast],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected auth = inject(AuthService);
  private loadouts = inject(LoadoutService);
  private router = inject(Router);
  private toast = inject(ToastService);

  constructor() {
    this.auth.ensureChecked();
    // The API sends the browser back with ?signin=failed if Google sign-in didn't complete.
    inject(ActivatedRoute).queryParamMap.subscribe((params) => {
      if (params.get('signin') === 'failed') {
        this.toast.show('Sign-in did not complete. Please try again.');
        this.router.navigate([], { queryParams: { signin: null }, replaceUrl: true });
      }
    });
  }

  signIn() {
    this.auth.signIn();
  }

  async signOut() {
    await this.auth.signOut();
    this.loadouts.reset();
    this.router.navigateByUrl('/');
  }
}
