import { Component, input, output } from '@angular/core';
import { Attachments } from '../../../core/models/loadout.model';
import { LOADOUT_FIELDS } from '../../../data/loadout-fields.data';

/** Creator, loadout name, and the 8 attachment fields. Emits immutable updates. */
@Component({
  selector: 'app-loadout-form',
  imports: [],
  templateUrl: './loadout-form.html',
  styleUrl: './loadout-form.css',
})
export class LoadoutForm {
  creator = input.required<string>();
  name = input.required<string>();
  attachments = input.required<Attachments>();

  creatorChange = output<string>();
  nameChange = output<string>();
  attachmentsChange = output<Attachments>();

  fields = LOADOUT_FIELDS;

  updateField(key: keyof Attachments, e: Event) {
    const value = (e.target as HTMLInputElement).value;
    this.attachmentsChange.emit({ ...this.attachments(), [key]: value });
  }
}
