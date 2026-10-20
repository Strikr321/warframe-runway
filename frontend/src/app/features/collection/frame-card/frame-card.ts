import { Component, computed, input, output, signal } from '@angular/core';
import { Loadout, MAX_LOADOUTS_PER_FRAME } from '../../../core/models/loadout.model';

/**
 * One frame in the Collection grid: 3D tilt on hover, and with 2+ loadouts
 * the mini-cards fan out as a regular polygon.
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
  /** Count badge; shown in By-Warframe view only. */
  badge = input<boolean>(true);
  /** True when the matching Recently Edited card is hovered. */
  highlighted = input<boolean>(false);

  /** Loadout id to open: the first loadout from the card body, or a specific mini-card. */
  openLoadout = output<string>();
  /** "+" or an empty card was clicked. */
  createRequested = output<void>();
  toggleFav = output<void>();
  hoverChange = output<boolean>();

  get isEmpty(): boolean { return this.loadouts().length === 0; }
  get first(): Loadout | undefined { return this.loadouts()[0]; }
  get hasFav(): boolean { return this.loadouts().some(l => l.fav); }
  get atCap(): boolean { return this.loadouts().length >= MAX_LOADOUTS_PER_FRAME; }

  // ── 3D tilt ──────────────────────────────────────────────────
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

  // ── Fan-out ──────────────────────────────────────────────────
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

  /** Mini-card transform: spread when fanned, shrunk to center otherwise. */
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
  onMiniClick(l: Loadout, e: Event) {
    e.stopPropagation();
    this.openLoadout.emit(l.id);
  }
  onCreateClick(e: Event) {
    e.stopPropagation();
    this.createRequested.emit();
  }
  onEditClick(e: Event) {
    e.stopPropagation();
    if (this.first) this.openLoadout.emit(this.first.id);
  }
  onFavClick(e: Event) {
    e.stopPropagation();
    this.toggleFav.emit();
  }
}
