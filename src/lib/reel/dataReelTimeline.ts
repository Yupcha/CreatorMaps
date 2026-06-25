/**
 * Pure timeline engine for the Data Reel — no DOM, no maplibre, no stores.
 *
 * Computes the keyframes ONCE (snapshot of the top-N states, beat-snapped enter
 * times, real values, colors, bar percents) and exposes an allocation-light
 * sampler that returns the per-frame view-model. BOTH the live in-app preview
 * AND the offscreen 2D export compositor call {@link sampleReel} with the same
 * easings, so preview and file are frame-identical.
 *
 * Reveal order is lowest-rank-first (rank N → rank 1, the climb to #1) so the
 * leaderboard builds toward the winner.
 */

import { indiaStates, type IndiaStateData } from '$lib/data/countryData';
import {
  METRIC_CONFIGS,
  getMetricColor,
  normalizeStateName,
  type OverlayMetric
} from '$lib/data/indiaConstants';
import {
  makeBeatGrid,
  easeOutCubic,
  smoothInOut,
  springOvershoot,
  TIMING
} from '$lib/reels';

export interface ReelKeyframe {
  /** 1 = highest. */
  rank: number;
  state: IndiaStateData;
  /** Curated-data-key normalized name (join key for setFeatureState). */
  normalizedName: string;
  /** Real metric value (NOT the config display-min). */
  value: number;
  /** 'rgba(...)' fill color (from getMetricColor). */
  color: string;
  /** Spark-bar target percent 2..100 (config min/max domain). */
  barPct: number;
  /** Beat-snapped time (ms) the state begins to reveal. */
  tEnter: number;
}

export interface ReelRow extends ReelKeyframe {
  /** Counter value rolling 0 → value (easeOutCubic). */
  counter: number;
  /** Spark-bar current width percent (smoothInOut to barPct). */
  barWidth: number;
  /** On-map / fill reveal 0 → ~1.08 → 1.0 (springOvershoot). */
  revealAlpha: number;
  /** Rank badge scale-in 0 → 1 (springOvershoot). */
  badgeScale: number;
  /** 0..1 how fully this row has settled (for stable row ordering / opacity). */
  settle: number;
}

export interface ReelViewModel {
  rows: ReelRow[];
  /** Establishing/title push-in 0..1 over the intro window. */
  introProgress: number;
  /** Outro hold/fade 0..1 over the outro window. */
  outroProgress: number;
  phase: 'intro' | 'reveal' | 'outro';
  metric: OverlayMetric;
}

export interface BuildReelOptions {
  metric: OverlayMetric;
  topN: number;
  durationMs: number;
  bpm: number;
  beatsPerState: number;
}

export interface ReelTimeline {
  keyframes: ReelKeyframe[];
  metric: OverlayMetric;
  durationMs: number;
  /** ms the reveal sequence starts (after intro). */
  revealStartMs: number;
  /** ms the reveal sequence ends (before outro). */
  revealEndMs: number;
  /** ms the outro begins. */
  outroStartMs: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Build the immutable keyframe list. Snapshots a LOCAL sorted copy of
 * indiaStates so the global overlayMetric store is never touched.
 */
export function buildDataReelKeyframes(opts: BuildReelOptions): ReelTimeline {
  const { metric, durationMs, bpm, beatsPerState } = opts;
  const cfg = METRIC_CONFIGS[metric];
  const topN = clamp(Math.round(opts.topN), 3, Math.min(20, indiaStates.length));

  const sorted = [...indiaStates]
    .sort((a, b) => (b[metric] as number) - (a[metric] as number))
    .slice(0, topN);

  const grid = makeBeatGrid(bpm, durationMs);

  // Intro: 2 beats (title + establishing). Outro: 2 beats (hold + watermark fade).
  const introBeats = 2;
  const outroBeats = 2;
  const revealStartMs = grid.at(introBeats);

  // Reveal lowest rank first (climb to #1). Map reveal index i (0..topN-1) to a
  // rank that descends: i=0 → rank topN, i=topN-1 → rank 1.
  const keyframes: ReelKeyframe[] = sorted.map((state, idx) => {
    const rank = idx + 1; // idx 0 = #1 (highest)
    const value = state[metric] as number;
    const c = getMetricColor(metric, value);
    const barPct = clamp(((value - cfg.min) / (cfg.max - cfg.min)) * 100, 2, 100);
    // reveal order: lowest first → reveal slot = (topN - rank)
    const revealSlot = topN - rank;
    const tEnter = grid.at(introBeats + revealSlot * beatsPerState);
    return {
      rank,
      state,
      normalizedName: normalizeStateName(state.name),
      value,
      color: `rgba(${c[0]},${c[1]},${c[2]},${((c[3] ?? 255) / 255).toFixed(3)})`,
      barPct,
      tEnter
    };
  });

  // last reveal slot end
  const lastSlot = topN - 1;
  const revealEndMs = grid.at(introBeats + (lastSlot + 1) * beatsPerState);
  const outroStartMs = Math.min(durationMs - grid.at(outroBeats), Math.max(revealEndMs, revealStartMs));

  return { keyframes, metric, durationMs, revealStartMs, revealEndMs, outroStartMs };
}

/**
 * Sample the timeline at time `t` (ms). Returns the per-frame view-model.
 * Allocation-light hot path — one array of rows for revealed keyframes only.
 */
export function sampleReel(timeline: ReelTimeline, t: number): ReelViewModel {
  const { keyframes, metric, durationMs, revealStartMs, outroStartMs } = timeline;

  const introProgress = clamp(t / Math.max(1, revealStartMs), 0, 1);
  const outroProgress =
    t <= outroStartMs ? 0 : clamp((t - outroStartMs) / Math.max(1, durationMs - outroStartMs), 0, 1);
  const phase: ReelViewModel['phase'] =
    t < revealStartMs ? 'intro' : t >= outroStartMs ? 'outro' : 'reveal';

  const rows: ReelRow[] = [];
  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];
    if (t < kf.tEnter) continue;
    const local = t - kf.tEnter;

    // fill/badge pop (springOvershoot over POP_MS)
    const popT = clamp(local / TIMING.POP_MS, 0, 1);
    const revealAlpha = popT <= 0 ? 0 : springOvershoot(popT);
    const badgeScale = popT <= 0 ? 0 : springOvershoot(popT);

    // counter + bar start LEAD_DELAY after the color pop
    const ct = clamp((local - TIMING.LEAD_DELAY_MS) / TIMING.COUNTER_ROLL_MS, 0, 1);
    const bt = clamp((local - TIMING.LEAD_DELAY_MS) / TIMING.BAR_GROW_MS, 0, 1);
    const counter = kf.value * easeOutCubic(ct);
    const barWidth = kf.barPct * smoothInOut(bt);
    const settle = clamp(local / (TIMING.LEAD_DELAY_MS + TIMING.COUNTER_ROLL_MS), 0, 1);

    rows.push({ ...kf, counter, barWidth, revealAlpha, badgeScale, settle });
  }

  // Stable display order: by rank ascending (#1 at top) once revealed.
  rows.sort((a, b) => a.rank - b.rank);

  return { rows, introProgress, outroProgress, phase, metric };
}
