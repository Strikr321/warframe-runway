export interface LayoutRenderConfig {
  imageAlign: 'left' | 'right' | 'center';
  infoPosition: 'right' | 'left' | 'below' | 'split';
  namePosition: 'bottom-left' | 'bottom-right' | 'bottom-center' | 'middle';
}

export interface LayoutThumbRect { left?: string; right?: string; top?: string; bottom?: string; width?: string; height?: string; }

export interface PosterLayout {
  key: string;
  name: string;
  description: string;
  thumb: { img: LayoutThumbRect; text: LayoutThumbRect; text2?: LayoutThumbRect; name: LayoutThumbRect };
  render: LayoutRenderConfig;
}

/**
 * The 4 poster layouts, ported verbatim from the prototype's LAYOUTS
 * object. `thumb` positions the little preview rectangles in the
 * layout picker; `render` drives the actual canvas math.
 */
export const LAYOUTS: Record<string, PosterLayout> = {
  'left-classic': {
    key: 'left-classic',
    name: 'Classic Left',
    description: 'Image left, info right',
    thumb: {
      img:  { left: '4%', top: '13%', width: '52%', height: '74%' },
      text: { left: '60%', top: '13%', width: '36%', height: '74%' },
      name: { left: '4%', bottom: '3%', width: '92%', height: '7%' },
    },
    render: { imageAlign: 'left', infoPosition: 'right', namePosition: 'bottom-left' },
  },
  'right-classic': {
    key: 'right-classic',
    name: 'Classic Right',
    description: 'Image right, info left',
    thumb: {
      img:  { right: '4%', top: '13%', width: '52%', height: '74%' },
      text: { left: '4%', top: '13%', width: '36%', height: '74%' },
      name: { left: '4%', bottom: '3%', width: '92%', height: '7%' },
    },
    render: { imageAlign: 'right', infoPosition: 'left', namePosition: 'bottom-right' },
  },
  'center-showcase': {
    key: 'center-showcase',
    name: 'Showcase',
    description: 'Full-width image, info below',
    thumb: {
      img:   { left: '4%', top: '13%', width: '92%', height: '55%' },
      name:  { left: '8%', top: '60%', width: '36%', height: '5%' },
      text:  { left: '4%', top: '72%', width: '44%', height: '24%' },
      text2: { left: '52%', top: '72%', width: '44%', height: '24%' },
    },
    render: { imageAlign: 'center', infoPosition: 'below', namePosition: 'middle' },
  },
  'center-split': {
    key: 'center-split',
    name: 'Split',
    description: 'Center image, info split on sides',
    thumb: {
      text:  { left: '4%', top: '13%', width: '16%', height: '74%' },
      img:   { left: '24%', top: '13%', width: '52%', height: '74%' },
      text2: { left: '80%', top: '13%', width: '16%', height: '74%' },
      name:  { left: '4%', bottom: '3%', width: '92%', height: '7%' },
    },
    render: { imageAlign: 'center', infoPosition: 'split', namePosition: 'bottom-center' },
  },
};

export const LAYOUT_KEYS = Object.keys(LAYOUTS);
