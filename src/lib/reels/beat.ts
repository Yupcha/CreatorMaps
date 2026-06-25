/**
 * Beat / tempo timing hook (v1: timing-driven only; audio stubbed).
 *
 * Lets reels quantize motion/reveals to a musical grid so the result feels
 * "edited to the beat". v1 ships SILENT — creators add platform audio (IG/
 * Reels) themselves; we only align timing. The audio-merge path is stubbed and
 * documented at {@link attachAudioTrack} for the v2 fast-follow.
 *
 * Pure TS, no DOM/maplibre/stores — unit-testable.
 */

export const BPM_PRESETS = {
  normal: 120,
  cinematic: 100,
  epic: 90
} as const;

export type BpmPresetKey = keyof typeof BPM_PRESETS;

export interface BeatGrid {
  bpm: number;
  /** Milliseconds per beat (60000 / bpm). */
  beatMs: number;
  /** Total whole beats that fit in the duration. */
  totalBeats: number;
  /** Time (ms) of the Nth beat from start. */
  at(beat: number): number;
  /** Beat index (float) at a given time (ms). */
  beatAt(ms: number): number;
  /** Snap an arbitrary time (ms) to the nearest beat boundary. */
  snap(ms: number): number;
}

/** Build a beat grid for a given tempo + total duration. */
export function makeBeatGrid(bpm: number, durationMs: number): BeatGrid {
  const beatMs = 60000 / bpm;
  return {
    bpm,
    beatMs,
    totalBeats: Math.floor(durationMs / beatMs),
    at: (beat: number) => beat * beatMs,
    beatAt: (ms: number) => ms / beatMs,
    snap: (ms: number) => Math.round(ms / beatMs) * beatMs
  };
}

// ---- Shared easing curves (mirror app.css transition tokens) ----

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Decelerate into rest — arrivals, counter rolls. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
/** Accelerate then decelerate — travel legs, push-ins. */
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
/** Smooth in/out — bar growth, opacity (cubic-bezier(.4,0,.2,1) approx). */
export const smoothInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** Springy overshoot to ~1.08 then settle (cubic-bezier(.34,1.56,.64,1) feel). */
export const springOvershoot = (t: number) => {
  const x = clamp01(t);
  const c = 1.70158 * 1.2;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

/** Per-state reveal timing constants (Data Reel). */
export const TIMING = {
  LEAD_DELAY_MS: 120, // color appears before the number rolls
  POP_MS: 280, // fill/badge pop-in
  COUNTER_ROLL_MS: 480, // number count-up
  BAR_GROW_MS: 480 // spark-bar grow
} as const;

/**
 * STUB (v2): merge an audio track into a video MediaStream so the exported file
 * carries music. v1 records video-only. To implement: create an
 * AudioContext, decode a license-cleared loop from static/audio/, route an
 * AudioBufferSourceNode → ctx.createMediaStreamDestination(), then build
 * `new MediaStream([...video.getVideoTracks(), ...dest.stream.getAudioTracks()])`
 * and hand THAT to MediaRecorder. Returns the (possibly augmented) stream.
 *
 * For now it is a no-op pass-through so callers can wire the API today.
 */
export function attachAudioTrack(
  videoStream: MediaStream,
  _opts?: { src?: string; bpm?: number; volume?: number }
): MediaStream {
  // v1: silent. Audio merge is a documented fast-follow — see jsdoc above.
  return videoStream;
}
