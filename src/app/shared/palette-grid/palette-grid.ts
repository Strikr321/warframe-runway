import { Component, computed, input, output } from '@angular/core';

/**
 * THE 90-SWATCH GRID.
 * Pure display + event component, same shape as FrameCard: it repeats
 * (once per open color channel), so it earns its own file. Columns
 * are "A"-"E", rows are 1-18 — matches the naming you see in-game.
 */
@Component({
  selector: 'app-palette-grid',
  imports: [],
  templateUrl: './palette-grid.html',
  styleUrl: './palette-grid.css',
})
export class PaletteGrid {
  /** cols[columnIndex][rowIndex] -> hex */
  palette = input.required<string[][]>();
  selectedCol = input<number>(-1);
  selectedRow = input<number>(-1);

  pick = output<{ row: number; col: number; hex: string }>();

  /** Flattened once for the template: [{col, row, hex, label}, ...] in column-major order */
  cells = computed(() => {
    const cols = this.palette();
    const out: { col: number; row: number; hex: string; label: string }[] = [];
    cols.forEach((rows, ci) => {
      rows.forEach((hex, ri) => {
        out.push({ col: ci, row: ri, hex, label: `${String.fromCharCode(65 + ci)}${ri + 1}` });
      });
    });
    return out;
  });

  numCols = computed(() => this.palette().length);
  numRows = computed(() => this.palette()[0]?.length ?? 0);
}
