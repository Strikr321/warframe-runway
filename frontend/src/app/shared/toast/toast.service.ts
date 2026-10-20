import { Injectable, signal } from '@angular/core';

/** App-wide toast notifications. One <app-toast> in the shell renders the message. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private static readonly DURATION_MS = 2500;

  private readonly _message = signal('');
  readonly message = this._message.asReadonly();

  private timer: ReturnType<typeof setTimeout> | undefined;

  show(msg: string): void {
    this._message.set(msg);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this._message.set(''), ToastService.DURATION_MS);
  }
}
