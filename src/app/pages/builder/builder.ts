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

/**
 * THE BUILDER — Step 4a.
 * ======================
 * Reads an optional :id from the route:
 *   /builder        -> blank draft (optionally preselecting ?frame=X)
 *   /builder/:id    -> loads that loadout for editing
 *
 * On Save, hands the assembled draft to LoadoutService — the SAME
 * shared instance the Collection page reads from. Navigate back to
 * '/' and Collection already shows it. No refresh, no event bus,
 * no manual sync: this is dependency injection paying off exactly
 * the way Step 3's notes promised.
 *
 * Not in this step: image upload, poster canvas, layout picker,
 * export. Those are Step 4b — a big enough graphics engine to
 * deserve its own focused, visually-tested build.
 */
@Component({
  selector: 'app-builder',
  imports: [FrameSelector, LoadoutForm, ColorChannel],
  templateUrl: './builder.html',
  styleUrl: './builder.css',
})
export class Builder {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(LoadoutService);

  channels = CHANNELS;

  /** null = creating new; set = editing this existing loadout's id */
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
      if (existing) {
        this.loadDraft(existing);
      }
      // If the id doesn't match anything (bad link, deleted elsewhere),
      // we silently fall through to a blank new-loadout draft rather
      // than crashing the page.
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
      edited: new Date().toISOString(), // overwritten again inside the service, kept here for type completeness
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
