import { Attachments } from '../core/models/loadout.model';

/** One row in the Loadout form — label + hint ported from the prototype. */
export const LOADOUT_FIELDS: { key: keyof Attachments; label: string; hint: string }[] = [
  { key: 'skin',     label: 'Skin',     hint: 'Body appearance' },
  { key: 'helmet',   label: 'Helmet',   hint: 'Head' },
  { key: 'chest',    label: 'Chest',    hint: 'Chest armor' },
  { key: 'arms',     label: 'Arms',     hint: 'Arm armor' },
  { key: 'legs',     label: 'Legs',     hint: 'Leg armor' },
  { key: 'ephemera', label: 'Ephemera', hint: 'Effect' },
  { key: 'signa',    label: 'Signa',    hint: 'Sigil / Regalia' },
  { key: 'syandana', label: 'Syandana', hint: 'Cape / Back' },
];
