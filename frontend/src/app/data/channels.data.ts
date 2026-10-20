import { ChannelKey, ColorChannelState } from '../core/models/loadout.model';

export const CHANNELS: { key: ChannelKey; name: string; defaultColor: string }[] = [
  { key: 'primary', name: 'Primary', defaultColor: '#c8a030' },
  { key: 'secondary', name: 'Secondary', defaultColor: '#3080c8' },
  { key: 'tertiary', name: 'Tertiary', defaultColor: '#a0a0a0' },
  { key: 'accents', name: 'Accents', defaultColor: '#40b040' },
  { key: 'em1', name: 'Emissive I', defaultColor: '#e0e020' },
  { key: 'em2', name: 'Emissive II', defaultColor: '#e03010' },
  { key: 'en1', name: 'Energy I', defaultColor: '#20a0e0' },
  { key: 'en2', name: 'Energy II', defaultColor: '#a020e0' },
];

export function defaultColorState(): Record<ChannelKey, ColorChannelState> {
  const state = {} as Record<ChannelKey, ColorChannelState>;
  for (const ch of CHANNELS) {
    state[ch.key] = { palette: 'Tenno', row: 0, col: 0, hex: ch.defaultColor, label: '— Select —' };
  }
  return state;
}

/** Channels shown as the 4 color dots on Collection cards. */
const SUMMARY_CHANNELS: ChannelKey[] = ['primary', 'secondary', 'en1', 'en2'];

/** The 4 dots shown on Collection cards — a readable summary, not the full 8 channels. */
export function summaryColors(colorState: Record<ChannelKey, ColorChannelState>): string[] {
  return SUMMARY_CHANNELS.map((key) => colorState[key].hex);
}

/** A full color state whose summary channels match `colors`; the rest keep their defaults. */
export function colorStateFromSummary(
  colors: string[],
  label = 'Custom',
): Record<ChannelKey, ColorChannelState> {
  const state = defaultColorState();
  SUMMARY_CHANNELS.forEach((key, i) => {
    if (colors[i]) state[key] = { ...state[key], hex: colors[i], label };
  });
  return state;
}
