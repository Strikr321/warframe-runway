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
 * Nobody can have more than 6 loadouts for one Warframe. This isn't
 * arbitrary — the Collection card's hover fan-out is a circle (1 flat,
 * 2 up/down, 3 triangle, 4 square, 5 pentagon, 6 hexagon), and past 6
 * it stops being readable as a shape. FrameCard hides its "create
 * another" affordance once a frame hits this, and Builder refuses to
 * save a brand-new loadout past it too.
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
