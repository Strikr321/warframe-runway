import { Component, input, output } from '@angular/core';
import { Loadout } from '../../models/loadout.model';

/**
 * THE card — rendered up to 64 times by one @for loop in the page.
 * The textbook reason a component exists: it REPEATS. Fix the tilt
 * math here once and every card on screen is fixed.
 *
 * Inputs:  the frame name + its loadouts (possibly empty).
 * Outputs: open (card clicked), toggleFav (star clicked).
 *
 * The 3D tilt from the prototype is the same math, but instead of
 * addEventListener we use Angular event bindings, and instead of
 * mutating style directly we set signals that the template binds.
 */
@Component({
  selector: 'app-frame-card',
  imports: [],
  templateUrl: './frame-card.html',
  styleUrl: './frame-card.css',
})
export class FrameCard {
  frame = input.required<string>();
  loadouts = input.required<Loadout[]>();
  /** Show the count badge? (on in By-Warframe view, off in By-Loadout view) */
  badge = input<boolean>(true);

  open = output<void>();
  toggleFav = output<void>();

  // Tilt state — plain fields are fine here; they change on mousemove
  // and the template reads them through the transform getter.
  rotX = 0;
  rotY = 0;
  glossX = 50;
  glossY = -50;
  hovering = false;

  get isEmpty(): boolean { return this.loadouts().length === 0; }
  get first(): Loadout | undefined { return this.loadouts()[0]; }
  get hasFav(): boolean { return this.loadouts().some(l => l.fav); }

  get transform(): string {
    return this.hovering && !this.isEmpty
      ? `rotateX(${this.rotX}deg) rotateY(${this.rotY}deg) scale(1.04)`
      : 'rotateX(0) rotateY(0) scale(1)';
  }

  onMove(e: MouseEvent) {
    if (this.isEmpty) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.rotY = ((x - rect.width / 2) / (rect.width / 2)) * 12;   // max 12°
    this.rotX = ((rect.height / 2 - y) / (rect.height / 2)) * 12;
    this.glossX = (x / rect.width) * 100;
    this.glossY = (y / rect.height) * 100;
    this.hovering = true;
  }

  onLeave() { this.hovering = false; }

  onClick() {
    if (!this.isEmpty) this.open.emit();
  }

  onFavClick(e: MouseEvent) {
    // stopPropagation: the star sits INSIDE the card, so without this
    // a star click would also count as a card click and fire open.
    e.stopPropagation();
    this.toggleFav.emit();
  }
}
