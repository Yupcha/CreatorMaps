/**
 * Trip Reel glue: build the offscreen-compositor `drawOverlay` callback (stamps
 * + title card + watermark) and the scene-link payload. Keeps TripReelStudio
 * thin and keeps all canvas-2D painting in one testable place.
 *
 * Everything painted here goes through the Foundation compositor (recordReel's
 * `drawOverlay`) — DOM overlays are NOT captured by captureStream, so the
 * stamps/watermark MUST be drawn into the 2D canvas to land in the file.
 */

import {
  drawLabel,
  drawWatermark,
  drawTitleBlock,
  safeZone,
  COLORS,
  type ReelFrame
} from '$lib/reels';
import { easeOutCubic } from './easing';
import type { TripTimeline } from './tripChoreography';
import type { TripStop } from './tripChoreography';
import type { AspectKey } from '$lib/reels';

export interface TripOverlayConfig {
  timeline: TripTimeline;
  title?: string;
  watermark: boolean;
  logo?: CanvasImageSource | null;
  aspect: AspectKey;
}

/** Title-card window: shows over the first ~12% of the reel as a curtain hook. */
const TITLE_FRACTION = 0.12;

/**
 * Build the per-frame overlay painter for a trip reel. Reads the live
 * `timeline.activeStampAt(elapsedMs)` so stamps land exactly with arrivals.
 */
export function makeTripOverlay(cfg: TripOverlayConfig) {
  const { timeline, title, watermark, logo } = cfg;
  const titleEndMs = timeline.totalMs * TITLE_FRACTION;

  return function drawOverlay(ctx: CanvasRenderingContext2D, frame: ReelFrame): void {
    const { width: w, height: h, elapsedMs } = frame;
    const safe = safeZone(w, h);
    const shortEdge = Math.min(w, h);

    // ── Title card (intro hook) ──
    if (title && elapsedMs < titleEndMs) {
      // fade in over first 40%, hold, fade out over last 30% of the window
      const t = elapsedMs / titleEndMs;
      let alpha = 1;
      if (t < 0.4) alpha = t / 0.4;
      else if (t > 0.7) alpha = 1 - (t - 0.7) / 0.3;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      // subtle scrim so the title reads over any map
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(10,10,15,0.55)');
      grad.addColorStop(0.5, 'rgba(10,10,15,0.15)');
      grad.addColorStop(1, 'rgba(10,10,15,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      drawTitleBlock(ctx, {
        title,
        eyebrow: 'A Trip Across India',
        w,
        h,
        progress: Math.max(0, Math.min(1, alpha)),
        anchor: 'center'
      });
    }

    // ── Active stop stamp ──
    const active = timeline.activeStampAt(elapsedMs);
    if (active && active.alpha > 0.01) {
      const { stamp, alpha } = active;
      const e = easeOutCubic(alpha);
      // slide-up offset (rises as it fades in)
      const rise = (1 - e) * h * 0.035;

      // bottom stamp block, above the watermark + bottom safe zone
      const blockBottom = safe.y + safe.h - shortEdge * 0.06;
      const nameSize = Math.round(shortEdge * 0.05);
      const subSize = Math.round(shortEdge * 0.03);
      const distSize = Math.round(shortEdge * 0.028);
      const cx = w / 2;

      ctx.save();
      ctx.globalAlpha = e;

      // accent pin dot above the name
      const dotY = blockBottom - nameSize - subSize - distSize - shortEdge * 0.05 + rise;
      ctx.beginPath();
      ctx.fillStyle = COLORS.accentGreenLight;
      ctx.shadowColor = COLORS.accentGreen;
      ctx.shadowBlur = shortEdge * 0.03;
      ctx.arc(cx, dotY, shortEdge * 0.012, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // distance count-up line (only when this leg has distance)
      let y = blockBottom + rise;
      if (stamp.distance) {
        drawLabel(ctx, formatDistanceCountUp(stamp, alpha), cx, y, {
          size: distSize,
          color: COLORS.accentGreenLight,
          align: 'center',
          mono: true,
          weight: 600,
          alpha: e
        });
        y -= distSize * 1.5;
      }
      // subtitle
      if (stamp.subtitle) {
        drawLabel(ctx, stamp.subtitle, cx, y, {
          size: subSize,
          color: COLORS.textSecondary,
          align: 'center',
          weight: 500,
          alpha: e
        });
        y -= subSize * 1.5;
      }
      // name • state
      drawLabel(ctx, stamp.label, cx, y, {
        size: nameSize,
        color: COLORS.textPrimary,
        align: 'center',
        weight: 700,
        alpha: e
      });
    }

    // ── Watermark (always-on growth-loop hook) ──
    if (watermark) {
      drawWatermark(ctx, { w, h, logo, tagline: 'made with Yupcha Maps' });
    }
  };
}

/**
 * Count up the leg distance during the stamp fade-in (0→full) then hold.
 * Reuses the friendly "~X km · ~Yh by road" string for the final value.
 */
function formatDistanceCountUp(
  stamp: { distance?: string; distanceKm?: number },
  alpha: number
): string {
  if (!stamp.distance) return '';
  if (!stamp.distanceKm || alpha >= 0.999) return stamp.distance;
  // animate the leading km number; keep the rest of the string stable
  const m = stamp.distance.match(/^~([\d,]+)\s*km(.*)$/);
  if (!m) return stamp.distance;
  const target = stamp.distanceKm;
  const rolled = Math.round(target * easeOutCubic(alpha));
  const rest = m[2];
  return `~${rolled.toLocaleString('en-IN')} km${rest}`;
}

/** Build the scene-link `params` bag for a trip (compact for short URLs). */
export function tripSceneParams(stops: TripStop[], durationKey: string, music: string) {
  return {
    stops: stops.map((s) => ({
      n: s.name,
      st: s.state,
      lng: round5(s.lng),
      lat: round5(s.lat)
    })),
    dur: durationKey,
    music
  };
}

/** Parse a decoded scene's trip params back into store-ready values. */
export function parseTripSceneParams(params: Record<string, unknown> | undefined): {
  stops: TripStop[];
  durationKey?: string;
  music?: string;
} | null {
  if (!params || !Array.isArray((params as any).stops)) return null;
  const rawStops = (params as any).stops as any[];
  const stops: TripStop[] = rawStops
    .filter((s) => typeof s?.lng === 'number' && typeof s?.lat === 'number')
    .map((s) => ({ name: String(s.n ?? ''), state: String(s.st ?? ''), lng: s.lng, lat: s.lat }));
  if (stops.length < 2) return null;
  return {
    stops,
    durationKey: typeof (params as any).dur === 'string' ? (params as any).dur : undefined,
    music: typeof (params as any).music === 'string' ? (params as any).music : undefined
  };
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}
