import { Component, computed, input, output, signal } from '@angular/core';
import { ColorChannelState } from '../../../core/models/loadout.model';
import { PALETTES, PALETTE_NAMES } from '../../../data/palettes.data';
import { PaletteGrid } from '../../../shared/palette-grid/palette-grid';

/** One color channel row (Primary, Energy I, ...) with an expandable palette picker. */
@Component({
  selector: 'app-color-channel',
  imports: [PaletteGrid],
  templateUrl: './color-channel.html',
  styleUrl: './color-channel.css',
})
export class ColorChannel {
  channelName = input.required<string>();
  state = input.required<ColorChannelState>();
  colorChange = output<ColorChannelState>();

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
