import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Attachments,
  ChannelKey,
  ColorChannelState,
  Loadout,
  MAX_LOADOUTS_PER_FRAME,
  emptyAttachments,
} from '../../core/models/loadout.model';
import { CHANNELS, defaultColorState } from '../../data/channels.data';
import { LoadoutService } from '../../core/services/loadout.service';
import { FrameCatalogService } from '../../core/services/frame-catalog.service';
import { FrameSelector } from './frame-selector/frame-selector';
import { LoadoutForm } from './loadout-form/loadout-form';
import { ColorChannel } from './color-channel/color-channel';
import { HasUnsavedChanges } from './builder.guards';
import { PosterCanvas } from '../poster/poster-canvas/poster-canvas';

/** Create or edit a loadout (`/builder`, `/builder/:id`, `/builder?frame=X`) and generate its poster. */
@Component({
  selector: 'app-builder',
  imports: [FrameSelector, LoadoutForm, ColorChannel, PosterCanvas],
  templateUrl: './builder.html',
  styleUrl: './builder.css',
})
export class Builder implements HasUnsavedChanges {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(LoadoutService);
  catalog = inject(FrameCatalogService);

  channels = CHANNELS;

  editingId = signal<string | null>(null);

  frame = signal<string>(this.catalog.frames()[0] ?? 'Volt');
  name = signal('');
  creator = signal('');
  attachments = signal<Attachments>(emptyAttachments());
  colorState = signal<Record<ChannelKey, ColorChannelState>>(defaultColorState());

  isEditing = computed(() => this.editingId() !== null);
  /** Shown inline if a save is rejected for being past the per-frame cap. */
  capMessage = signal('');

  /** Draft as last loaded or saved; compared against the live draft to detect edits. */
  private savedSnapshot: string;
  /** Set once a save or delete succeeds, so the unsaved-changes guard lets us leave. */
  private leaving = false;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      // loadoutExistsGuard has already confirmed the id exists.
      this.loadDraft(this.store.byId(id)!);
    } else {
      const queryFrame = this.route.snapshot.queryParamMap.get('frame');
      if (queryFrame && this.catalog.frames().includes(queryFrame)) {
        this.frame.set(queryFrame);
      }
    }
    this.savedSnapshot = this.snapshot();
  }

  hasUnsavedChanges(): boolean {
    return !this.leaving && this.snapshot() !== this.savedSnapshot;
  }

  /** Browser-level warning when closing or reloading the tab with unsaved edits. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges()) e.preventDefault();
  }

  private snapshot(): string {
    return JSON.stringify([
      this.frame(),
      this.name(),
      this.creator(),
      this.attachments(),
      this.colorState(),
    ]);
  }

  private loadDraft(l: Loadout) {
    this.editingId.set(l.id);
    this.frame.set(l.frame);
    this.name.set(l.name);
    this.creator.set(l.creator);
    this.attachments.set(l.attachments);
    this.colorState.set(l.colorState);
  }

  onChannelChange(key: ChannelKey, next: ColorChannelState) {
    this.colorState.update((s) => ({ ...s, [key]: next }));
  }

  onFrameChange(frame: string) {
    this.frame.set(frame);
    this.capMessage.set(''); // a stale warning from a different frame shouldn't linger
  }

  save() {
    const draft: Loadout = {
      id: this.editingId() ?? crypto.randomUUID(),
      frame: this.frame(),
      name: this.name().trim() || 'Unnamed Loadout',
      creator: this.creator().trim() || 'Tenno',
      fav: this.isEditing() ? (this.store.byId(this.editingId()!)?.fav ?? false) : false,
      edited: new Date().toISOString(),
      attachments: this.attachments(),
      colorState: this.colorState(),
    };
    const ok = this.store.save(draft);
    if (!ok) {
      this.capMessage.set(
        `${this.frame()} already has ${MAX_LOADOUTS_PER_FRAME} loadouts — the max. Delete one first, or pick a different frame.`,
      );
      return;
    }
    this.leaving = true;
    this.router.navigateByUrl('/');
  }

  cancel() {
    this.router.navigateByUrl('/');
  }

  delete() {
    const id = this.editingId();
    if (!id || !window.confirm(`Delete "${this.name() || 'this loadout'}"? This can't be undone.`))
      return;
    this.store.delete(id);
    this.leaving = true;
    this.router.navigateByUrl('/');
  }
}
