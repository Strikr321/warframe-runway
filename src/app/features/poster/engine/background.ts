import { mixRgb, rgbCss, richenForGlow } from './color';

/**
 * The bell-curve atmospheric gradient + glow + vignette.
 * A genuine there-and-back flow between exactly two color slots:
 * `edgeColor` anchors BOTH the top and bottom, `glowColor` is the
 * bright peak in the middle — the same shape as light falling off
 * from a source, which is what makes this read as atmosphere rather
 * than a decorative stripe. Every mode (auto, single color, two
 * colors) is just a different choice of what fills these two slots;
 * there's only one flow, not six different ones.
 */
export function drawAtmosphereBg(ctx: CanvasRenderingContext2D, W: number, H: number, edgeColor: [number,number,number], glowColor: [number,number,number]) {
  const deepEdge = mixRgb(edgeColor, [8,5,6], 0.85);
  const richGlow = richenForGlow(glowColor);
  // Centered at the true vertical midpoint — a there-and-back flow
  // that peaks off-center reads as lopsided on a bare background,
  // even though the same math looked fine once a character was
  // composited on top and drew the eye toward that area instead.
  const bandCenter = 0.5, bandWidth = 0.22;

  // Vertical bell-curve gradient — deepEdge at t=0 AND t=1, richGlow
  // at the peak. Built from many sampled stops on a native
  // CanvasGradient so it's continuous, not 1750 rounded 1px strips.
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  const STOPS = 32;
  for (let i = 0; i <= STOPS; i++) {
    const t = i / STOPS;
    const glow = Math.exp(-((t-bandCenter)**2)/(2*bandWidth**2));
    bgGrad.addColorStop(t, rgbCss(mixRgb(deepEdge, richGlow, glow)));
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Soft radial glow — a NATIVE radial gradient, not blurred discrete
  // shapes. ctx.filter('blur') is a fast approximation, not a true
  // Gaussian, and at large radii it doesn't fully smooth away the
  // boundaries between stacked shapes — that's what was showing up
  // as visible concentric rings. A gradient has no boundaries to
  // begin with; it's continuous math, so there's nothing to blur.
  const gcx = W*0.5, gcy = H*0.38, maxRad = 620;
  const glowGrad = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, maxRad);
  glowGrad.addColorStop(0,    rgbCss(richGlow, 0.22));
  glowGrad.addColorStop(0.3,  rgbCss(richGlow, 0.17));
  glowGrad.addColorStop(0.6,  rgbCss(richGlow, 0.09));
  glowGrad.addColorStop(1,    rgbCss(richGlow, 0));
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H);

  // Vignette — same approach: a radial gradient, transparent center,
  // darkening toward the far corners, rather than a blurred rectangle.
  const vigGrad = ctx.createRadialGradient(W/2, H*0.45, H*0.35, W/2, H*0.45, H*0.85);
  vigGrad.addColorStop(0, rgbCss(deepEdge, 0));
  vigGrad.addColorStop(1, rgbCss(deepEdge, 0.65));
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, W, H);

  return deepEdge;
}
