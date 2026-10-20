import { mixRgb, rgbCss, richenForGlow } from './color';

/**
 * Atmospheric background: a vertical bell-curve gradient from `edgeColor`
 * (top and bottom) to `glowColor` (middle), plus a soft radial glow and a
 * vignette. Every color mode just chooses what fills these two slots.
 * Returns the darkened edge color for text tinting.
 */
export function drawAtmosphereBg(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  edgeColor: [number, number, number],
  glowColor: [number, number, number],
) {
  const deepEdge = mixRgb(edgeColor, [8, 5, 6], 0.85);
  const richGlow = richenForGlow(glowColor);
  // Peak at the true midpoint; off-center reads as lopsided on a bare background.
  const bandCenter = 0.5,
    bandWidth = 0.22;

  // Gaussian sampled into gradient stops, so the canvas interpolates smoothly between them.
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  const STOPS = 32;
  for (let i = 0; i <= STOPS; i++) {
    const t = i / STOPS;
    const glow = Math.exp(-((t - bandCenter) ** 2) / (2 * bandWidth ** 2));
    bgGrad.addColorStop(t, rgbCss(mixRgb(deepEdge, richGlow, glow)));
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Radial gradients rather than blurred shapes: ctx.filter blur leaves visible rings at large radii.
  const gcx = W * 0.5,
    gcy = H * 0.38,
    maxRad = 620;
  const glowGrad = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, maxRad);
  glowGrad.addColorStop(0, rgbCss(richGlow, 0.22));
  glowGrad.addColorStop(0.3, rgbCss(richGlow, 0.17));
  glowGrad.addColorStop(0.6, rgbCss(richGlow, 0.09));
  glowGrad.addColorStop(1, rgbCss(richGlow, 0));
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H);

  // Vignette
  const vigGrad = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.45, H * 0.85);
  vigGrad.addColorStop(0, rgbCss(deepEdge, 0));
  vigGrad.addColorStop(1, rgbCss(deepEdge, 0.65));
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, W, H);

  return deepEdge;
}
