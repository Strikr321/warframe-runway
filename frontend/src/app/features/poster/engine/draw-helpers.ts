
/** Small canvas drawing primitives shared by both poster renderers. */

export function drawGoldFrame(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const outer = 22, inner = 32;
  ctx.strokeStyle = 'rgba(200,160,90,.65)'; ctx.lineWidth = 2;
  ctx.strokeRect(outer, outer, W-outer*2, H-outer*2);
  ctx.strokeStyle = 'rgba(200,160,90,.35)'; ctx.lineWidth = 1;
  ctx.strokeRect(inner, inner, W-inner*2, H-inner*2);
  const dsize = 7, dcx = (outer+inner)/2;
  for (const [x,y] of [[dcx,dcx],[W-dcx,dcx],[dcx,H-dcx],[W-dcx,H-dcx]] as [number,number][]) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4);
    ctx.fillStyle = 'rgb(200,160,90)';
    ctx.fillRect(-dsize,-dsize,dsize*2,dsize*2);
    ctx.restore();
  }
}

/** Centered text with manual letter-spacing (ctx.letterSpacing isn't supported everywhere). */
export function drawTrackedText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, tracking: number) {
  const widths = Array.from(text).map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a,b) => a+b, 0) + tracking*(text.length-1);
  let x = cx - total/2;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x, y);
    x += widths[i] + tracking;
  }
}

/** Scale to fit within maxW x maxH, preserving aspect ratio. */
export function fitContain(bounds: {w:number;h:number}, maxH: number, maxW: number): { targetW: number; targetH: number } {
  const scale = Math.min(maxH / bounds.h, maxW / bounds.w);
  return { targetW: Math.round(bounds.w * scale), targetH: Math.round(bounds.h * scale) };
}

export function drawContactShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, targetW: number, targetH: number) {
  ctx.save();
  ctx.filter = 'blur(22px)';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx+targetW*0.5, cy+targetH*0.995, targetW*0.38, targetH*0.03, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

export function drawDivider(ctx: CanvasRenderingContext2D, xStart: number, xEnd: number, y: number) {
  const dg = ctx.createLinearGradient(xStart, 0, xEnd, 0);
  dg.addColorStop(0, 'rgba(200,149,42,0.3)'); dg.addColorStop(0.05, '#c8952a');
  dg.addColorStop(0.95, '#c8952a'); dg.addColorStop(1, 'rgba(200,149,42,0.3)');
  ctx.beginPath(); ctx.moveTo(xStart, y); ctx.lineTo(xEnd, y);
  ctx.strokeStyle = dg; ctx.lineWidth = 1.5; ctx.stroke();
}

export function loadImgEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}
