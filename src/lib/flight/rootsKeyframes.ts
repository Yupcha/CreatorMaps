/**
 * Roots Reel — declarative motion data for the space→rooftop staged descent.
 *
 * Separated from the animator (`rootsReel.ts`) so the cinematic numbers can be
 * tuned without touching control flow. The descent is a FIVE-leg staged dive
 * (NOT the 2-hop "timelapse" style, which whooshes via maplibre's parabolic
 * zoom-out across ~11 zoom levels). Each leg jumps ≤4 zoom levels so flyTo's
 * internal interpolation stays smooth at 60fps; pitch and bearing ramp
 * CONTINUOUSLY across legs (camera tilts up toward the horizon — the
 * premium-drone tell) rather than snapping per leg.
 *
 * Pure data + a tiny duration helper. No Svelte / maplibre / turf deps.
 */

export type RootsTier = 'space' | 'country' | 'state' | 'district' | 'point';

export interface RootsLeg {
  tier: RootsTier;
  /** Target zoom at the end of this leg (strictly increasing). */
  zoom: number;
  /** Target pitch (deg) — continuous ramp 0 → 70. */
  pitch: number;
  /** Target bearing (deg) — gentle drift then a confident final turn. */
  bearing: number;
  /** flyTo curve: far legs cruise (1.1), the final plunge dives (1.4). */
  curve: number;
  /** Fraction of the descent budget (the legs sum to 1 with FINAL hold folded in). */
  weight: number;
}

/**
 * Five legs, monotonically increasing zoom, continuous pitch/bearing ramp.
 *  L0 SPACE     z2.6  p0   b0    — Earth from above
 *  L1 INDIA     z4.5  p15  b-8   — the subcontinent resolves
 *  L2 STATE     z6.5  p35  b-8   — the home state
 *  L3 DISTRICT  z10.5 p52  b20   — the home district / city
 *  L4 POINT     z16.5 p70  b35   — the rooftop / chosen point (then FINAL_BREATH)
 *
 * Weights are non-uniform (NOT totalMs/n): the descent lingers longest on the
 * final approach so the emotional landing has room to breathe. The 0.18 final
 * hold is realized by FINAL_BREATH, so the five leg weights sum to ~0.82.
 */
export const ROOTS_LEGS: readonly RootsLeg[] = [
  { tier: 'space', zoom: 2.6, pitch: 0, bearing: 0, curve: 1.1, weight: 0.09 },
  { tier: 'country', zoom: 4.5, pitch: 15, bearing: -8, curve: 1.1, weight: 0.15 },
  { tier: 'state', zoom: 6.5, pitch: 35, bearing: -8, curve: 1.15, weight: 0.18 },
  { tier: 'district', zoom: 10.5, pitch: 52, bearing: 20, curve: 1.25, weight: 0.18 },
  { tier: 'point', zoom: 16.5, pitch: 70, bearing: 35, curve: 1.4, weight: 0.22 }
] as const;

/** The held "name card" moment after landing — a living, drifting camera. */
export const FINAL_BREATH = {
  /** rAF-timed steps over `holdMs`. */
  steps: 40,
  /** Total bearing creep over the hold (deg). */
  bearingDelta: 12,
  /** Peak pitch bob amplitude (deg) via a sine wobble. */
  pitchBob: 3,
  /** How long the held card lingers (ms). */
  holdMs: 2500
} as const;

/** Pre-move hold on the space shot so the reel opens on a steady Earth frame. */
export const SPACE_HOLD_MS = 600;

/** Per-leg "satellite settle" after tiles report loaded — kills blur/half-loaded frames. */
export const SATELLITE_SETTLE_MS = 350;

/**
 * Reveal lead: the name/title card fades in starting this many ms BEFORE the
 * end of the reel, so it lands exactly as the camera settles on the point.
 * Foundation's compositor supplies `frame.progress`; we map it through this.
 */
export const TITLE_REVEAL_LEAD_MS = 1500;

/**
 * Split a total duration across the five legs by weight, reserving the FINAL
 * breath hold. Returns one ms value per leg (length === ROOTS_LEGS.length).
 *
 * The hold is taken off the top so the per-leg flyTo durations + the hold ==
 * totalMs exactly (modulo rounding).
 */
export function computeLegDurations(totalMs: number): number[] {
  const flightBudget = Math.max(0, totalMs - FINAL_BREATH.holdMs);
  const weightSum = ROOTS_LEGS.reduce((s, l) => s + l.weight, 0);
  return ROOTS_LEGS.map((leg) => Math.max(300, Math.round((leg.weight / weightSum) * flightBudget)));
}
