import { Component, computed, input, output, signal } from '@angular/core';
import { Loadout, MAX_LOADOUTS_PER_FRAME } from '../../models/loadout.model';

/**
 * THE card — rendered up to 64 times by one @for loop in the page.
 * The textbook reason a component exists: it REPEATS. Fix the tilt
 * math here once and every card on screen is fixed.
 *
 * Step 5 addition: cards with 2+ loadouts fan their mini-cards out in
 * a circle on hover (1 flat, 2 up/down, 3 triangle, 4 square, 5
 * pentagon, 6 hexagon — MAX_LOADOUTS_PER_FRAME caps it there). A
 * shared `highlighted` input lets the Collection page link this card
 * to its Recently Edited counterpart in both directions.
 *
 * The fan-out is entirely template-bound (no imperative DOM code):
 * @for keeps the mini-cards permanently mounted, keyed by loadout id,
 * so toggling `fanned` only ever changes a bound style property on
 * elements that already exist — a completely normal CSS transition,
 * the same as everything else in this app. There's no "newly created
 * element with no previous frame to animate from" problem to work
 * around, because nothing is created or destroyed by hovering.
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
  /** Driven by the page's shared hoveredFrame signal — true when THIS
   *  frame is highlighted from the Recently Edited row (or vice versa). */
  highlighted = input<boolean>(false);

  /** Open a specific loadout — the id, whether from the card body
   *  (the "cover"/first loadout) or from clicking a specific fanned
   *  mini-card. One output, always a concrete id, no ambiguity. */
  openLoadout = output<string>();
  /** "+" clicked, or an empty card clicked — create a new loadout for this frame. */
  createRequested = output<void>();
  toggleFav = output<void>();
  /** Tells the page this card is being hovered, so it can highlight
   *  the matching Recently Edited card too. */
  hoverChange = output<boolean>();

  get isEmpty(): boolean { return this.loadouts().length === 0; }
  get first(): Loadout | undefined { return this.loadouts()[0]; }
  get hasFav(): boolean { return this.loadouts().some(l => l.fav); }
  get atCap(): boolean { return this.loadouts().length >= MAX_LOADOUTS_PER_FRAME; }

  // ── 3D tilt (unchanged from Step 2) ──────────────────────────
  rotX = 0;
  rotY = 0;
  glossX = 50;
  glossY = -50;
  hovering = false;

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
    this.rotY = ((x - rect.width / 2) / (rect.width / 2)) * 12;
    this.rotX = ((rect.height / 2 - y) / (rect.height / 2)) * 12;
    this.glossX = (x / rect.width) * 100;
    this.glossY = (y / rect.height) * 100;
    this.hovering = true;
  }
  onLeave() { this.hovering = false; }

  // ── Fan-out (new in Step 5) — entirely template-driven, see the
  // class doc comment above for why no imperative DOM code is needed.
  fanned = signal(false);

  /** 1 flat, 2 up/down, 3 triangle, 4 square, 5 pentagon, 6 hexagon. */
  radius = computed(() => {
    const n = this.loadouts().length;
    return n <= 3 ? 78 : n <= 5 ? 92 : 105;
  });
  ringDiameter = computed(() => (this.radius() + 75) * 2);

  positions = computed(() => {
    const n = this.loadouts().length;
    const r = this.radius();
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const deg = -90 + i * (360 / n);
      const rad = deg * Math.PI / 180;
      pts.push({ x: Math.cos(rad) * r, y: Math.sin(rad) * r });
    }
    return pts;
  });

  /** Transform for mini-card at index i — spread position when fanned,
   *  shrunk to center otherwise. Read directly from the template. */
  miniTransform(i: number): string {
    if (!this.fanned()) return 'translate(-50%,-50%) scale(.4)';
    const p = this.positions()[i];
    return `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px)) scale(1)`;
  }

  onWrapperEnter() {
    if (this.loadouts().length >= 2) this.fanned.set(true);
    this.hoverChange.emit(true);
  }
  onWrapperLeave() {
    this.fanned.set(false);
    this.hoverChange.emit(false);
  }

  onCardClick() {
    if (this.isEmpty) this.createRequested.emit();
    else if (this.first) this.openLoadout.emit(this.first.id);
  }
  onMiniClick(l: Loadout, e: MouseEvent) {
    e.stopPropagation();
    this.openLoadout.emit(l.id);
  }
  onCreateClick(e: MouseEvent) {
    e.stopPropagation();
    this.createRequested.emit();
  }
  onEditClick(e: MouseEvent) {
    e.stopPropagation();
    if (this.first) this.openLoadout.emit(this.first.id);
  }
  onFavClick(e: MouseEvent) {
    e.stopPropagation();
    this.toggleFav.emit();
  }
}
