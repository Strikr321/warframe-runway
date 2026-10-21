import { CHANNELS, isColorPicked } from '../../../data/channels.data';
import { LOADOUT_FIELDS } from '../../../data/loadout-fields.data';
import { PosterInput } from './poster-input';

export interface FieldRow {
  label: string;
  value: string;
}

export interface ColorRow {
  label: string;
  value: string;
  hex: string;
}

/**
 * What the poster lists: only attachments that are filled in and color channels the user
 * actually picked. Empty rows and placeholder swatches would advertise choices nobody made.
 */
export function posterRows(input: Pick<PosterInput, 'attachments' | 'colorState'>): {
  fields: FieldRow[];
  colors: ColorRow[];
} {
  const fields = LOADOUT_FIELDS.flatMap((f) => {
    const value = input.attachments[f.key]?.trim();
    return value ? [{ label: f.label.toUpperCase(), value }] : [];
  });
  const colors = CHANNELS.flatMap((ch) => {
    const state = input.colorState[ch.key];
    return isColorPicked(state)
      ? [{ label: ch.name.toUpperCase(), value: state.label, hex: state.hex }]
      : [];
  });
  return { fields, colors };
}
