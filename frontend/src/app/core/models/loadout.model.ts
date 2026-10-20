/**
 * A saved loadout. `attachments` and `colorState` are optional only because
 * the demo seed data predates them; loadouts saved from the Builder always
 * have both.
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

/**
 * Per-frame cap. The Collection card fans loadouts out as a regular
 * polygon on hover, and past a hexagon the shape stops reading clearly.
 */
export const MAX_LOADOUTS_PER_FRAME = 6;

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

export type ChannelKey = 'primary' | 'secondary' | 'tertiary' | 'accents' | 'em1' | 'em2' | 'en1' | 'en2';

export interface ColorChannelState {
  palette: string;
  row: number;
  col: number;
  hex: string;
  label: string;
}
