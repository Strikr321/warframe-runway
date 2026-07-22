/**
 * THE DATA CONTRACT — extended for Step 4.
 * ==========================================
 * `attachments` and `colorState` are optional so Step 3's seed data
 * (which has neither) keeps working without a migration. Real
 * loadouts created through the Builder will always have both.
 */
export interface Loadout {
  id: string;
  frame: string;
  name: string;
  creator: string;
  colors: string[];              // 4-color summary shown on cards (derived at save time)
  fav: boolean;
  edited: string;                // ISO timestamp
  attachments?: Attachments;
  colorState?: Record<ChannelKey, ColorChannelState>;
}

export interface Attachments {
  skin: string;
  helmet: string;
  chest: string;
  arms: string;
  legs: string;
  ephemera: string;
  signa: string;
  syandana: string;
}

export function emptyAttachments(): Attachments {
  return { skin: '', helmet: '', chest: '', arms: '', legs: '', ephemera: '', signa: '', syandana: '' };
}

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

// ── Color channels ──────────────────────────────────────────
export type ChannelKey = 'primary' | 'secondary' | 'tertiary' | 'accents' | 'em1' | 'em2' | 'en1' | 'en2';

export interface ColorChannelState {
  palette: string;
  row: number;
  col: number;
  hex: string;
  label: string;
}

export const CHANNELS: { key: ChannelKey; name: string; defaultColor: string }[] = [
  { key: 'primary',   name: 'Primary',     defaultColor: '#c8a030' },
  { key: 'secondary', name: 'Secondary',   defaultColor: '#3080c8' },
  { key: 'tertiary',  name: 'Tertiary',    defaultColor: '#a0a0a0' },
  { key: 'accents',   name: 'Accents',     defaultColor: '#40b040' },
  { key: 'em1',       name: 'Emissive I',  defaultColor: '#e0e020' },
  { key: 'em2',       name: 'Emissive II', defaultColor: '#e03010' },
  { key: 'en1',       name: 'Energy I',    defaultColor: '#20a0e0' },
  { key: 'en2',       name: 'Energy II',   defaultColor: '#a020e0' },
];

export function defaultColorState(): Record<ChannelKey, ColorChannelState> {
  const state = {} as Record<ChannelKey, ColorChannelState>;
  for (const ch of CHANNELS) {
    state[ch.key] = { palette: 'Tenno', row: 0, col: 0, hex: ch.defaultColor, label: '— Select —' };
  }
  return state;
}

/** The 4 dots shown on Collection cards — a readable summary, not the full 8 channels. */
export function summaryColors(colorState: Record<ChannelKey, ColorChannelState>): string[] {
  return [colorState.primary.hex, colorState.secondary.hex, colorState.tertiary.hex, colorState.accents.hex];
}

/** All frames in the game — drives the "By Warframe" grid and the Frame Selector. */
export const FRAMES: string[] = ['Ash','Atlas','Banshee','Baruuk','Caliban','Chroma','Citrine','Cyte-09','Dagath','Dante','Ember','Equinox','Excalibur','Follie','Frost','Gara','Garuda','Gauss','Grendel','Gyre','Harrow','Hildryn','Hydroid','Inaros','Ivara','Jade','Khora','Koumei','Kullervo','Lavos','Limbo','Loki','Mag','Mesa','Mirage','Nekros','Nezha','Nidus','Nokko','Nova','Nyx','Oberon','Octavia','Oraxia','Protea','Qorvex','Revenant','Rhino','Saryn','Sevagoth','Styanax','Temple','Titania','Trinity','Uriel','Valkyr','Vauban','Volt','Voruna','Wisp','Wukong','Xaku','Yareli','Zephyr'];
