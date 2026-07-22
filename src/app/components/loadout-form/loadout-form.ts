import { Component, input, output } from '@angular/core';
import { Attachments, LOADOUT_FIELDS } from '../../models/loadout.model';

/**
 * FORM COMPONENT.
 * Creator name, loadout name, and the 8 attachment fields (skin,
 * helmet, chest...). Grouped into one component because these fields
 * live and die together — you never show half a loadout form.
 *
 * One output per top-level concept (creator, name) plus a single
 * `attachmentsChange` for the 8-field group — updateField() rebuilds
 * the whole Attachments object immutably (spread), same habit as
 * LoadoutService: never mutate, always replace.
 */
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
