import { Attachments, ChannelKey, ColorChannelState } from '../../../core/models/loadout.model';
import { PosterLayout } from '../../../data/layouts.data';

/** Crop rectangle in the source image's own pixel coordinates. */
export interface SourceCrop { srcX: number; srcY: number; srcW: number; srcH: number; }

export interface PosterColor { hex: string; label: string; }

/** Everything a renderer needs, captured once when "Generate Poster" is clicked. */
export interface PosterInput {
  frame: string;
  name: string;
  creator: string;
  attachments: Attachments;
  colorState: Record<ChannelKey, ColorChannelState>;
  layoutKey: string;
  layout: PosterLayout;
  imageDataUrl: string | null;
  /** Photo mode only: the crop the preview showed, or null when there is no image. */
  crop: SourceCrop | null;
  posterColor1: PosterColor | null;
  posterColor2: PosterColor | null;
  bgSwapped: boolean;
}
