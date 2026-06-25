/**
 * Aspect ratio + resolution presets for reel/poster export.
 *
 * The single source of truth for output dimensions across ALL four reels and
 * the poster exporter. Aspect is realized by the offscreen-canvas size (and/or
 * the map container resize) — `map.resize()` re-derives the projection, so no
 * engine change is needed beyond feeding these width/height pairs.
 */

export type AspectKey = '9:16' | '1:1' | '16:9';

/** Quality tier — scales the base aspect dimensions. */
export type ResolutionKey = 'sd' | 'hd' | 'fhd' | '4k';

export interface Dimensions {
  w: number;
  h: number;
}

/**
 * Base dimensions per aspect (at "fhd" quality). 9:16 → 1080×1920 portrait,
 * 1:1 → 1080×1080 square, 16:9 → 1920×1080 landscape.
 */
export const ASPECT_PRESETS: Record<AspectKey, Dimensions> = {
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '16:9': { w: 1920, h: 1080 }
};

/** Scale factor applied to the base aspect dimensions per quality tier. */
export const RESOLUTION_SCALE: Record<ResolutionKey, number> = {
  sd: 0.5, // e.g. 540×960 for 9:16
  hd: 0.6667, // ~720 short edge
  fhd: 1, // base (1080 short edge)
  '4k': 2 // 2160 short edge
};

/** Even integer (H.264/VP9 encoders prefer even dimensions). */
function even(n: number): number {
  const r = Math.round(n);
  return r % 2 === 0 ? r : r + 1;
}

/**
 * Resolve final output {w,h} for a given aspect + quality tier.
 * Dimensions are clamped to even integers.
 */
export function resolveDimensions(aspect: AspectKey, resolution: ResolutionKey = 'fhd'): Dimensions {
  const base = ASPECT_PRESETS[aspect];
  const scale = RESOLUTION_SCALE[resolution];
  return { w: even(base.w * scale), h: even(base.h * scale) };
}

/**
 * Pick a sensible video bitrate (bits/sec) for a given pixel count.
 * Ladder mirrors CinematicBar: 4k≈50Mbps, 1080p≈25Mbps, 720p≈12Mbps,
 * with a 9:16 1080×1920 (~2.07MP) ≈ 18Mbps tier in between.
 */
export function bitrateForPixels(w: number, h: number): number {
  const px = w * h;
  if (px >= 3840 * 2160 * 0.9) return 50_000_000; // ~4k
  if (px >= 1920 * 1080 * 0.9) return 25_000_000; // ~1080p landscape
  if (px >= 1080 * 1920 * 0.9) return 18_000_000; // ~9:16 1080×1920
  if (px >= 1280 * 720 * 0.9) return 12_000_000; // ~720p
  return 8_000_000;
}

/** Frame rate heuristic — drop to 30fps for very large frames to avoid drops. */
export function fpsForPixels(w: number, h: number): number {
  return w * h >= 3840 * 2160 * 0.9 ? 30 : 60;
}
