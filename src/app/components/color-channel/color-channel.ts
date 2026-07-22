import { Component, computed, input, output, signal } from '@angular/core';
import { ColorChannelState } from '../../models/loadout.model';
import { PALETTES, PALETTE_NAMES } from '../../data/palettes.data';
import { PaletteGrid } from '../palette-grid/palette-grid';

/**
 * COMPOSITE COMPONENT — repeats 8x (once per channel: Primary,
 * Secondary, Energy I...). Each instance owns its own "is this
 * expanded" state locally (that's UI state, not data, so a plain
 * signal here is correct — it doesn't belong in the service).
 *
 * Wraps PaletteGrid, which is why PaletteGrid gets reused rather than
 * copy-pasted: the same grid also could power a poster background
 * picker later (Step 4b) without writing it twice.
 */
@Component({
  selector: 'app-color-channel',
  imports: [PaletteGrid],
  templateUrl: './color-channel.html',
  styleUrl: './color-channel.css',
})
export class ColorChannel {
  channelName = input.required<string>();
  state = input.required<ColorChannelState>();
  change = output<ColorChannelState>();

  open = signal(false);

  /** Local override while picking a different palette than the saved one. */
  private paletteOverride = signal<string | null>(null);
  activePalette = computed(() => this.paletteOverride() ?? this.state().palette);

  paletteNames = PALETTE_NAMES;
  activeCells = computed(() => PALETTES[this.activePalette()]);

  toggle() {
    this.open.update(v => !v);
  }

  onPaletteSelect(e: Event) {
    this.paletteOverride.set((e.target as HTMLSelectElement).value);
  }

  onPick(cell: { row: number; col: number; hex: string }) {
    const paletteName = this.activePalette();
    const label = `${paletteName} ${String.fromCharCode(65 + cell.col)}${cell.row + 1}`;
    this.change.emit({ palette: paletteName, row: cell.row, col: cell.col, hex: cell.hex, label });
    this.paletteOverride.set(null);
    this.open.set(false);
  }
}
