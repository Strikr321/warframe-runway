import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  template: `<div class="toast" [class.show]="toast.message()" role="status" aria-live="polite">
    {{ toast.message() }}
  </div>`,
  styles: `
    .toast {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%) translateY(80px);
      background: var(--surface2);
      border: 1px solid var(--gold);
      color: var(--gold-light);
      font-family: 'Cinzel', serif;
      font-size: 11px;
      letter-spacing: 0.2em;
      padding: 12px 24px;
      z-index: 100;
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      pointer-events: none;
    }
    .toast.show {
      transform: translateX(-50%) translateY(0);
    }
  `,
})
export class Toast {
  protected toast = inject(ToastService);
}
