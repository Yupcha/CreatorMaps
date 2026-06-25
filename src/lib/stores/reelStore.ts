/**
 * Data Reel state — classic svelte/store writables (matches mapStore.ts /
 * indiaGeoStore.ts conventions, NOT Svelte 5 runes).
 *
 * This state is deliberately REEL-LOCAL: it never mutates the global
 * `overlayMetric` store (which is shared by the live map choropleth, the
 * StateTooltip and the ChartsPanel). The Data Reel snapshots its own metric so
 * running/recording a reel does not visibly disturb normal app use.
 *
 * Aspect/resolution/watermark/title for the shared export pipeline already live
 * in `$lib/reels` (reelAspect/reelResolution/reelWatermark/reelTitle). These
 * here are the extra Data-Reel-specific knobs (metric, duration tempo, top-N,
 * bpm, playing flag).
 */

import { writable, type Writable } from 'svelte/store';
import type { OverlayMetric } from '$lib/data/indiaConstants';

/** Duration tempo presets for the reel (NO 'quick' — 0.8s/state is too frantic). */
export type ReelDurationKey = 'normal' | 'cinematic' | 'epic';

export interface ReelDurationPreset {
  key: ReelDurationKey;
  label: string;
  ms: number;
  /** Default BPM that beats the per-state reveal feel right. */
  bpm: number;
  /** Beats allotted to each state's reveal. */
  beatsPerState: number;
  /** Max sensible Top-N for this duration. */
  maxTopN: number;
}

export const REEL_DURATIONS: ReelDurationPreset[] = [
  { key: 'normal', label: '15s', ms: 15000, bpm: 120, beatsPerState: 2, maxTopN: 10 },
  { key: 'cinematic', label: '30s', ms: 30000, bpm: 100, beatsPerState: 4, maxTopN: 12 },
  { key: 'epic', label: '60s', ms: 60000, bpm: 90, beatsPerState: 4, maxTopN: 20 }
];

export function durationPreset(key: ReelDurationKey): ReelDurationPreset {
  return REEL_DURATIONS.find((d) => d.key === key) ?? REEL_DURATIONS[0];
}

/** Reel-local metric (never mutates the global overlayMetric). */
export const reelMetric: Writable<OverlayMetric> = writable('population');

/** Duration tempo preset. */
export const reelDurationKey: Writable<ReelDurationKey> = writable('normal');

/** Beats-per-minute. Defaults follow the duration preset but is independently editable. */
export const reelBpm: Writable<number> = writable(120);

/** How many states to reveal. */
export const reelTopN: Writable<number> = writable(10);

/** Optional slow bearing drift during the reveal (cheap, no flyTo / tile streaming). */
export const reelBearingDrift: Writable<boolean> = writable(false);

/** True while a preview/record is in flight (drives the panel's play/stop UI). */
export const isReelPlaying: Writable<boolean> = writable(false);
