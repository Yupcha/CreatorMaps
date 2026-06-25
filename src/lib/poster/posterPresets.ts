/**
 * Poster / wallpaper dimension presets + safety clamps.
 *
 * Single source of truth for poster output dimensions. Unlike the reel
 * `aspect.ts` (video tiers), posters need print-grade sizes (A4 @ 300dpi) and
 * social portrait crops. Pure TS — no DOM, no GL — so it is unit-testable and
 * importable from worker/SSR contexts.
 *
 * Dimensions are expressed in CSS pixels at dpr = 1; the effective pixel size
 * is `w * dpr` × `h * dpr`, clamped by {@link clampDimensions} so we never ask a
 * WebGL backing store for something it cannot allocate (GPUs typically cap
 * texture/renderbuffer dimensions around 8192–16384, and very large canvases
 * blow up peak memory during PNG encode).
 */

export type PosterAspectKey = '9:16' | '1:1' | '16:9' | '4:5' | 'print-a4';

export interface PosterPreset {
  /** Width in CSS px at dpr=1. */
  w: number;
  /** Height in CSS px at dpr=1. */
  h: number;
  /** Human label for the chip UI. */
  label: string;
  /** Short usage hint. */
  hint: string;
}

export const POSTER_PRESETS: Record<PosterAspectKey, PosterPreset> = {
  '9:16': { w: 1080, h: 1920, label: 'Phone Wallpaper', hint: '9:16 · lock screen' },
  '1:1': { w: 1080, h: 1080, label: 'IG Post', hint: '1:1 · square' },
  '16:9': { w: 1920, h: 1080, label: 'Desktop', hint: '16:9 · widescreen' },
  '4:5': { w: 1080, h: 1350, label: 'IG Portrait', hint: '4:5 · feed portrait' },
  'print-a4': { w: 2480, h: 3508, label: 'A4 Print', hint: 'A4 · 300 dpi' }
};

/** Order for rendering chips (default first). */
export const POSTER_ASPECT_ORDER: PosterAspectKey[] = ['9:16', '1:1', '16:9', '4:5', 'print-a4'];

/** Hard caps — keep per-dimension under the common WebGL limit and area sane. */
export const MAX_DIM = 8192;
export const MAX_AREA = 64_000_000; // 64 MP

export interface ClampResult {
  /** Final width in CSS px (unchanged from input). */
  w: number;
  /** Final height in CSS px (unchanged from input). */
  h: number;
  /** Effective device-pixel ratio after down-scaling to respect caps. */
  dpr: number;
  /** True if dpr was reduced below the requested value. */
  reduced: boolean;
  /** Effective pixel width (w * dpr, rounded). */
  pxW: number;
  /** Effective pixel height (h * dpr, rounded). */
  pxH: number;
}

/**
 * Compute the effective dpr so that:
 *   max(w, h) * dpr <= MAX_DIM   and   (w * dpr) * (h * dpr) <= MAX_AREA.
 * Reduces the requested dpr (never increases it) and flags whether it changed.
 */
export function clampDimensions(w: number, h: number, dpr: number): ClampResult {
  const requested = Math.max(0.5, dpr);
  let effective = requested;

  // Per-dimension cap.
  const dimCap = MAX_DIM / Math.max(w, h);
  if (effective > dimCap) effective = dimCap;

  // Area cap (dpr scales area quadratically).
  const areaCap = Math.sqrt(MAX_AREA / (w * h));
  if (effective > areaCap) effective = areaCap;

  // Round to a friendly 0.05 step, never below 0.5.
  effective = Math.max(0.5, Math.round(effective * 20) / 20);

  const pxW = Math.round(w * effective);
  const pxH = Math.round(h * effective);

  return {
    w,
    h,
    dpr: effective,
    reduced: effective < requested - 1e-6,
    pxW,
    pxH
  };
}

/** Aspect ratio (w/h) for a preset — used for center-crop math. */
export function aspectRatio(key: PosterAspectKey): number {
  const p = POSTER_PRESETS[key];
  return p.w / p.h;
}
