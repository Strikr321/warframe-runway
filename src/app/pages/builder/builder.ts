import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Attachments, ChannelKey, ColorChannelState, CHANNELS,
  Loadout, MAX_LOADOUTS_PER_FRAME, defaultColorState, emptyAttachments, summaryColors,
} from '../../models/loadout.model';
import { LoadoutService } from '../../services/loadout.service';
import { FrameCatalogService } from '../../services/frame-catalog.service';
import { FrameSelector } from '../../components/frame-selector/frame-selector';
import { LoadoutForm } from '../../components/loadout-form/loadout-form';
import { ColorChannel } from '../../components/color-channel/color-channel';
import { PosterCanvas } from '../../components/poster-canvas/poster-canvas';

/**
 * THE BUILDER — Step 4b added the Poster Generator. This delivery
 * swaps the hardcoded FRAMES import for FrameCatalogService's live,
 * fetched list — the Frame Selector now shows whatever the catalog
 * currently has (including anything newly released), not a frozen
 * snapshot from when this file was written.
 */
@Component({
  selector: 'app-builder',
  imports: [FrameSelector, LoadoutForm, ColorChannel, PosterCanvas],
  templateUrl: './builder.html',
  styleUrl: './builder.css',
})
export class Builder {
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

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const existing = this.store.byId(id);
      if (existing) this.loadDraft(existing);
    } else {
      const queryFrame = this.route.snapshot.queryParamMap.get('frame');
      if (queryFrame && this.catalog.frames().includes(queryFrame)) {
        this.frame.set(queryFrame);
      }
    }
  }

  private loadDraft(l: Loadout) {
    this.editingId.set(l.id);
    this.frame.set(l.frame);
    this.name.set(l.name);
    this.creator.set(l.creator);
    this.attachments.set(l.attachments ?? emptyAttachments());
    this.colorState.set(l.colorState ?? defaultColorState());
  }

  onChannelChange(key: ChannelKey, next: ColorChannelState) {
    this.colorState.update(s => ({ ...s, [key]: next }));
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
      colors: summaryColors(this.colorState()),
      fav: this.isEditing() ? (this.store.byId(this.editingId()!)?.fav ?? false) : false,
      edited: new Date().toISOString(),
      attachments: this.attachments(),
      colorState: this.colorState(),
    };
    const ok = this.store.save(draft);
    if (!ok) {
      this.capMessage.set(`${this.frame()} already has ${MAX_LOADOUTS_PER_FRAME} loadouts — the max. Delete one first, or pick a different frame.`);
      return;
    }
    this.router.navigateByUrl('/');
  }

  cancel() {
    this.router.navigateByUrl('/');
  }

  delete() {
    const id = this.editingId();
    if (id) {
      this.store.delete(id);
      this.router.navigateByUrl('/');
    }
  }
}
