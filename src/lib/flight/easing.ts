/**
 * Pure, zero-dependency easing + bearing helpers for the flight engine.
 *
 * These are passed as maplibre `easing` callbacks to flyTo/easeTo (the legacy
 * CinematicBar engine never passed one, so everything was default-eased — this
 * is the single biggest "premium feel" lever for Trip Reel) and used by the
 * triproute choreography for travel-leg progress and glide-not-snap heading.
 *
 * No imports — unit-testable in isolation.
 */

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Decelerate into rest — arrival/landing descent. */
export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

/** Strong takeoff lift then settle — the establishing bbox fit. */
export function easeInOutQuart(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
}

/** Accelerate out of and decelerate into stops — travel-leg progress. */
export function easeInOutSine(t: number): number {
  const x = clamp01(t);
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

/** Smooth in/out (cubic-bezier(.4,0,.2,1) approximation). */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Signed shortest angular delta from `a` to `b` (degrees), result in
 * (-180, 180]. Lets bearings cross the 0/360 seam without spinning the long way.
 */
export function shortestAngleDelta(a: number, b: number): number {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  // normalize the +180 edge so we never return exactly -180 vs 180 inconsistently
  if (d === -180) d = 180;
  return d;
}

/**
 * Low-pass / exponential-smoothing of a heading: nudges `prev` toward `target`
 * by `alpha` along the shortest arc, wrapping into [0, 360). Small alpha (0.12)
 * = a heavy, gliding camera that never snaps when the route curves.
 */
export function lowPassBearing(prev: number, target: number, alpha = 0.12): number {
  const delta = shortestAngleDelta(prev, target);
  const next = prev + delta * clamp01(alpha);
  return ((next % 360) + 360) % 360;
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
