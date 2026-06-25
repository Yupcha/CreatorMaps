/**
 * One-shot poster compositor (pure Canvas-2D).
 *
 * Takes the rendered map canvas and paints a framed, titled, watermarked poster
 * at the exact target pixel size, then encodes a PNG via `toBlob` (NOT
 * `toDataURL` — toBlob bounds peak memory for large prints).
 *
 * The map is drawn with object-fit:cover (center-crop), so the on-screen
 * safe-frame guide in PosterStudio is WYSIWYG. All text is painted AFTER
 * `document.fonts.ready` + explicit font loads so Inter / JetBrains Mono never
 * fall back to a system face on the first cold export.
 *
 * No store imports — fully parameterized so it is reusable as the shared still
 * compositor for other reels.
 */

import { POSTER_PRESETS, type PosterAspectKey } from './posterPresets';

const ACCENT = '#6366f1';
const ACCENT_GLOW = 'rgba(99,102,241,0.45)';
const BG = '#0a0a0f';
const TEXT_PRIMARY = '#ffffff';
const TEXT_SECONDARY = '#a1a1aa';

export interface PosterLayout {
  /** Effective pixel width of the output. */
  pxW: number;
  /** Effective pixel height of the output. */
  pxH: number;
  /** Scale factor (1 at 1080-short-edge baseline) for type sizing. */
  uiScale: number;
}

export interface ComposePosterOptions {
  /** Source map canvas (live or offscreen snapshot). */
  mapCanvas: HTMLCanvasElement;
  /** Target aspect preset key. */
  aspect: PosterAspectKey;
  /** Effective device pixel ratio (post-clamp). */
  dpr: number;
  /** Main title (e.g. state / city name). */
  title?: string;
  /** Subtitle (e.g. capital, tagline). */
  subtitle?: string;
  /** Mono stat line (e.g. "POP 12.3 Cr · 307,713 km² · 82.9% literacy"). */
  statLine?: string;
  /** Show the Yupcha watermark. */
  showWatermark?: boolean;
  /** Clean mode: skip ALL chrome (frame/title/watermark/QR), map only. */
  showClean?: boolean;
  /** Share URL (rendered as caption near QR). */
  shareUrl?: string;
  /** Pre-rendered QR canvas (corner). */
  qrCanvas?: HTMLCanvasElement | null;
}

export interface ComposePosterResult {
  pngBlob: Blob;
  layout: PosterLayout;
  /** A data URL of the composited canvas (used by the SVG embed path). */
  dataUrl: string;
}

/** Ensure the poster fonts are loaded before any fillText. */
async function ensurePosterFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('700 64px Inter'),
      document.fonts.load('600 40px Inter'),
      document.fonts.load('500 28px "JetBrains Mono"')
    ]);
    await document.fonts.ready;
  } catch {
    /* fall through — worst case is a fallback face */
  }
}

/** Create the backing canvas (HTMLCanvasElement — broad Safari/toBlob support). */
function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Center-crop (object-fit:cover) source rect for drawing into dest w×h. */
function coverRect(srcW: number, srcH: number, destW: number, destH: number) {
  const srcAspect = srcW / srcH;
  const destAspect = destW / destH;
  let sw = srcW;
  let sh = srcH;
  if (srcAspect > destAspect) {
    // source wider → crop sides
    sw = Math.round(srcH * destAspect);
  } else {
    // source taller → crop top/bottom
    sh = Math.round(srcW / destAspect);
  }
  const sx = Math.round((srcW - sw) / 2);
  const sy = Math.round((srcH - sh) / 2);
  return { sx, sy, sw, sh };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export async function composePoster(
  opts: ComposePosterOptions
): Promise<ComposePosterResult> {
  const preset = POSTER_PRESETS[opts.aspect];
  const pxW = Math.round(preset.w * opts.dpr);
  const pxH = Math.round(preset.h * opts.dpr);
  const uiScale = Math.min(pxW, pxH) / 1080;

  const layout: PosterLayout = { pxW, pxH, uiScale };

  await ensurePosterFonts();

  const canvas = makeCanvas(pxW, pxH);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Map (object-fit: cover).
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, pxW, pxH);
  const { sx, sy, sw, sh } = coverRect(
    opts.mapCanvas.width,
    opts.mapCanvas.height,
    pxW,
    pxH
  );
  ctx.drawImage(opts.mapCanvas, sx, sy, sw, sh, 0, 0, pxW, pxH);

  if (!opts.showClean) {
    drawChrome(ctx, opts, layout);
  }

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      'image/png'
    );
  });
  const dataUrl = canvas.toDataURL('image/png');

  return { pngBlob, layout, dataUrl };
}

/** Paint the frame, gradient scrim, title block, stat line, watermark, QR. */
function drawChrome(
  ctx: CanvasRenderingContext2D,
  opts: ComposePosterOptions,
  layout: PosterLayout
) {
  const { pxW, pxH, uiScale } = layout;
  const pad = Math.round(48 * uiScale);
  const frameInset = Math.round(28 * uiScale);

  // Bottom gradient scrim so text is legible over any map.
  const scrimH = Math.round(pxH * 0.42);
  const grad = ctx.createLinearGradient(0, pxH - scrimH, 0, pxH);
  grad.addColorStop(0, 'rgba(10,10,15,0)');
  grad.addColorStop(1, 'rgba(10,10,15,0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, pxH - scrimH, pxW, scrimH);

  // Thin accent vector frame.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, Math.round(2 * uiScale));
  roundRect(
    ctx,
    frameInset,
    frameInset,
    pxW - frameInset * 2,
    pxH - frameInset * 2,
    Math.round(18 * uiScale)
  );
  ctx.stroke();
  // Accent corner accents.
  ctx.strokeStyle = ACCENT;
  ctx.shadowColor = ACCENT_GLOW;
  ctx.shadowBlur = 14 * uiScale;
  ctx.lineWidth = Math.max(2, Math.round(4 * uiScale));
  const cl = Math.round(56 * uiScale);
  const cx0 = frameInset;
  const cy0 = frameInset;
  const cx1 = pxW - frameInset;
  const cy1 = pxH - frameInset;
  // top-left
  ctx.beginPath();
  ctx.moveTo(cx0, cy0 + cl);
  ctx.lineTo(cx0, cy0);
  ctx.lineTo(cx0 + cl, cy0);
  ctx.stroke();
  // bottom-right
  ctx.beginPath();
  ctx.moveTo(cx1, cy1 - cl);
  ctx.lineTo(cx1, cy1);
  ctx.lineTo(cx1 - cl, cy1);
  ctx.stroke();
  ctx.restore();

  // Title block (anchored lower third for the rule-of-thirds composition).
  const baseY = pxH - pad - Math.round(60 * uiScale);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  let cursorY = baseY;

  // Eyebrow accent dash.
  ctx.fillStyle = ACCENT;
  ctx.fillRect(pad + frameInset, baseY - Math.round(118 * uiScale), Math.round(56 * uiScale), Math.round(5 * uiScale));

  if (opts.statLine) {
    ctx.font = `500 ${Math.round(28 * uiScale)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.fillText(opts.statLine, pad + frameInset, cursorY);
    cursorY -= Math.round(46 * uiScale);
  }

  if (opts.subtitle) {
    ctx.font = `600 ${Math.round(40 * uiScale)}px Inter, sans-serif`;
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.fillText(opts.subtitle, pad + frameInset, cursorY);
    cursorY -= Math.round(70 * uiScale);
  }

  if (opts.title) {
    ctx.font = `700 ${Math.round(82 * uiScale)}px Inter, sans-serif`;
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8 * uiScale;
    ctx.fillText(opts.title, pad + frameInset, cursorY);
    ctx.shadowBlur = 0;
  }

  // Watermark wordmark (bottom-left baseline of the frame inset region).
  if (opts.showWatermark !== false) {
    ctx.font = `600 ${Math.round(26 * uiScale)}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Yupcha Maps', pad + frameInset, pxH - pad);
  }

  // QR + share caption (bottom-right).
  if (opts.qrCanvas) {
    const qrSize = Math.round(150 * uiScale);
    const qx = pxW - frameInset - pad - qrSize;
    const qy = pxH - frameInset - pad - qrSize;
    // white quiet card behind QR
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, qx - Math.round(8 * uiScale), qy - Math.round(8 * uiScale), qrSize + Math.round(16 * uiScale), qrSize + Math.round(16 * uiScale), Math.round(10 * uiScale));
    ctx.fill();
    ctx.drawImage(opts.qrCanvas, qx, qy, qrSize, qrSize);
    ctx.font = `500 ${Math.round(18 * uiScale)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('scan to remix', pxW - frameInset - pad, qy - Math.round(14 * uiScale));
    ctx.textAlign = 'left';
  }
}
