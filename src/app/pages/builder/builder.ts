import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Attachments, ChannelKey, ColorChannelState, CHANNELS, FRAMES,
  Loadout, defaultColorState, emptyAttachments, summaryColors,
} from '../../models/loadout.model';
import { LoadoutService } from '../../services/loadout.service';
import { FrameSelector } from '../../components/frame-selector/frame-selector';
import { LoadoutForm } from '../../components/loadout-form/loadout-form';
import { ColorChannel } from '../../components/color-channel/color-channel';
import { PosterCanvas } from '../../components/poster-canvas/poster-canvas';

/**
 * THE BUILDER — Step 4b adds the Poster Generator.
 * PosterCanvas is a leaf: it reads frame/name/creator/attachments/
 * colorState as inputs to render text, but owns all of its own
 * image/crop/layout/export state internally (see poster-canvas.ts).
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

  channels = CHANNELS;

  editingId = signal<string | null>(null);

  frame = signal<string>(FRAMES[0]);
  name = signal('');
  creator = signal('');
  attachments = signal<Attachments>(emptyAttachments());
  colorState = signal<Record<ChannelKey, ColorChannelState>>(defaultColorState());

  isEditing = computed(() => this.editingId() !== null);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const existing = this.store.byId(id);
      if (existing) this.loadDraft(existing);
    } else {
      const queryFrame = this.route.snapshot.queryParamMap.get('frame');
      if (queryFrame && FRAMES.includes(queryFrame)) {
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
    this.store.save(draft);
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
