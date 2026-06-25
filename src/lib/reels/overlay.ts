/**
 * Text / title overlay compositing helpers (pure Canvas-2D, no DOM, no stores).
 *
 * WHY THIS EXISTS: `canvas.captureStream()` taps ONLY the raw maplibre WebGL
 * canvas. DOM/HTML overlays are NEVER captured. So any title, subtitle,
 * location label, counter, or watermark that must appear in the exported file
 * has to be PAINTED into the offscreen 2D compositor that wraps the map canvas.
 *
 * These functions are passed (directly or via a composed callback) as the
 * `drawOverlay(ctx, frame)` argument to {@link recordReel}. They use the app's
 * design tokens (Inter / JetBrains Mono, accent colors from app.css) as
 * literals so the file matches the on-screen look.
 *
 * SAFE ZONES: vertical (9:16) platform UI eats the top ~14% and bottom ~14%.
 * Helpers honor a safe-zone inset so text/watermark never sit under platform
 * chrome. Use {@link safeZone} to compute the usable rect.
 */

export const FONT_TITLE = '"Inter", system-ui, sans-serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

// Design tokens (literals — Canvas can't read CSS vars)
export const COLORS = {
  bg: '#0a0a0f',
  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa',
  textTertiary: '#71717a',
  accentPrimary: '#6366f1',
  accentSecondary: '#8b5cf6',
  accentGreen: '#10b981',
  accentGreenLight: '#34d399'
};

export interface SafeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Compute the safe drawing rect inside platform chrome.
 * For 9:16, reserves ~14% top + ~14% bottom; tighter for square/landscape.
 */
export function safeZone(w: number, h: number): SafeRect {
  const portrait = h > w;
  const topPct = portrait ? 0.1 : 0.06;
  const bottomPct = portrait ? 0.14 : 0.08;
  const sidePct = 0.06;
  return {
    x: w * sidePct,
    y: h * topPct,
    w: w * (1 - sidePct * 2),
    h: h * (1 - topPct - bottomPct)
  };
}

/** clamp helper */
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** easeOutCubic for fade/rise */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

export interface TitleBlockOpts {
  title: string;
  subtitle?: string;
  /** Optional small label above the title (e.g. location tier "VARANASI"). */
  eyebrow?: string;
  w: number;
  h: number;
  /** 0..1 reveal progress (fades + rises in). Default 1 (fully shown). */
  progress?: number;
  /** Vertical anchor: 'top' | 'center' | 'bottom'. Default 'bottom'. */
  anchor?: 'top' | 'center' | 'bottom';
}

/**
 * Draw the main title / subtitle block (the viral hook for Roots/Trip).
 * Text rises + fades in with the supplied `progress`. Auto-scales the title
 * font to the frame's short edge so 9:16 / 1:1 / 16:9 all read well.
 */
export function drawTitleBlock(ctx: CanvasRenderingContext2D, opts: TitleBlockOpts): void {
  const { title, subtitle, eyebrow, w, h } = opts;
  const progress = opts.progress ?? 1;
  const anchor = opts.anchor ?? 'bottom';
  if (progress <= 0) return;

  const e = easeOutCubic(progress);
  const rise = (1 - e) * (h * 0.04); // rises up 4% as it fades in
  const alpha = e;
  const safe = safeZone(w, h);
  const shortEdge = Math.min(w, h);
  const titleSize = Math.round(shortEdge * 0.072);
  const subSize = Math.round(shortEdge * 0.036);
  const eyebrowSize = Math.round(shortEdge * 0.028);

  let baseY: number;
  if (anchor === 'top') baseY = safe.y + titleSize;
  else if (anchor === 'center') baseY = h / 2;
  else baseY = safe.y + safe.h - subSize * 1.4 - (subtitle ? subSize * 1.4 : 0);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = w / 2;

  // soft shadow for legibility over any map
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = shortEdge * 0.02;
  ctx.shadowOffsetY = shortEdge * 0.004;

  if (eyebrow) {
    ctx.font = `600 ${eyebrowSize}px ${FONT_MONO}`;
    ctx.fillStyle = COLORS.accentGreenLight;
    ctx.fillText(eyebrow.toUpperCase(), cx, baseY - titleSize - eyebrowSize * 0.6 + rise);
  }

  ctx.font = `700 ${titleSize}px ${FONT_TITLE}`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(title, cx, baseY + rise);

  if (subtitle) {
    ctx.font = `500 ${subSize}px ${FONT_TITLE}`;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.shadowBlur = shortEdge * 0.012;
    ctx.fillText(subtitle, cx, baseY + subSize * 1.5 + rise);
  }
  ctx.restore();
}

/** A single line of label/value text (e.g. a per-stop stamp or stat line). */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; color?: string; align?: CanvasTextAlign; mono?: boolean; weight?: number; alpha?: number } = {}
): void {
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.font = `${opts.weight ?? 600} ${opts.size ?? 28}px ${opts.mono ? FONT_MONO : FONT_TITLE}`;
  ctx.fillStyle = opts.color ?? COLORS.textPrimary;
  ctx.textAlign = opts.align ?? 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = (opts.size ?? 28) * 0.4;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export interface WatermarkOpts {
  w: number;
  h: number;
  /** Brand wordmark. Default "Yupcha Maps". */
  brand?: string;
  /** Optional second line (e.g. the share URL / "made with"). */
  tagline?: string;
  /** Optional preloaded logo image to draw before the wordmark. */
  logo?: CanvasImageSource | null;
  alpha?: number;
}

/**
 * Draw the subtle "made with Yupcha Maps" watermark in the bottom safe zone.
 * This is the growth-loop hook baked into every export.
 */
export function drawWatermark(ctx: CanvasRenderingContext2D, opts: WatermarkOpts): void {
  const { w, h } = opts;
  const brand = opts.brand ?? 'Yupcha Maps';
  const safe = safeZone(w, h);
  const shortEdge = Math.min(w, h);
  const size = Math.round(shortEdge * 0.026);
  const y = safe.y + safe.h - size * 0.4;
  const x = w / 2;

  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 0.85;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.5;

  let cx = x;
  if (opts.logo) {
    const logoSize = size * 1.2;
    // place logo just left of centered text — approximate centering
    const textWidth = brand.length * size * 0.52;
    const startX = x - (textWidth + logoSize + size * 0.3) / 2;
    try {
      ctx.drawImage(opts.logo, startX, y - logoSize * 0.85, logoSize, logoSize);
    } catch {
      /* tainted/невалид logo — skip silently */
    }
    cx = startX + logoSize + size * 0.3;
    ctx.textAlign = 'left';
  }

  ctx.font = `600 ${size}px ${FONT_TITLE}`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(brand, cx, y);

  if (opts.tagline) {
    ctx.globalAlpha = (opts.alpha ?? 0.85) * 0.7;
    ctx.textAlign = 'center';
    ctx.font = `400 ${Math.round(size * 0.7)}px ${FONT_MONO}`;
    ctx.fillStyle = COLORS.textTertiary;
    ctx.fillText(opts.tagline, x, y + size * 1.05);
  }
  ctx.restore();
}

/** Fill the whole frame with the app bg color at the given alpha (intro/outro fades). */
export function drawCurtain(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Load the brand logo (static/logo.svg) as an HTMLImageElement once.
 * Returns null on failure (watermark falls back to text only).
 */
let logoCache: HTMLImageElement | null | undefined;
export function loadBrandLogo(src = '/logo.svg'): Promise<HTMLImageElement | null> {
  if (logoCache !== undefined) return Promise.resolve(logoCache);
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      logoCache = null;
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      logoCache = img;
      resolve(img);
    };
    img.onerror = () => {
      logoCache = null;
      resolve(null);
    };
    img.src = src;
  });
}

/** Ensure brand fonts are loaded before painting text (avoids fallback faces). */
export async function ensureFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`700 64px ${FONT_TITLE}`),
      document.fonts.load(`500 28px ${FONT_MONO}`)
    ]);
    await document.fonts.ready;
  } catch {
    /* ignore */
  }
}
