/**
 * Roots Reel feature store — classic svelte/store writables (NOT runes), to
 * match the mapStore / indiaGeoStore conventions. Holds the Roots scene state:
 * the chosen place, the emotional caption, and the chosen format/duration.
 *
 * This is the serialization unit for the share-link (encoded via the Foundation
 * `encodeScene` into `scene.params`) and the hydration target when a `?scene=`
 * link reopens the app.
 *
 * The cross-cutting export settings (aspect / watermark / progress / rendering)
 * already live in the Foundation shared store (`$lib/reels` → reelAspect,
 * reelWatermark, reelRendering, reelProgress). We deliberately reuse those
 * rather than duplicating, so there is a single source of truth.
 */

import { writable } from 'svelte/store';
import type { AspectKey } from '$lib/reels';

export type RootsDurationKey = 'punchy' | 'cinematic';

export interface RootsScene {
  /** The resolved place at the bottom of the descent. */
  place: { name: string; state: string; lat: number; lng: number };
  /** Optional tuned final camera (from a known indianLocations entry). */
  finalZoom?: number;
  finalPitch?: number;
  finalBearing?: number;
  /** Emotional overlay copy. */
  title: string;
  subtitle: string;
  /** 6s "Punchy" or 12s "Cinematic". */
  durationKey: RootsDurationKey;
  /** Output aspect (default 9:16 portrait). */
  aspect: AspectKey;
}

/** Duration presets (ms) for the two Roots chips. */
export const ROOTS_DURATIONS: Record<RootsDurationKey, { label: string; sub: string; ms: number }> = {
  punchy: { label: 'Punchy', sub: '6s', ms: 6000 },
  cinematic: { label: 'Cinematic', sub: '12s', ms: 12000 }
};

const DEFAULT_SCENE: RootsScene = {
  place: { name: '', state: '', lat: 0, lng: 0 },
  title: '',
  subtitle: '',
  durationKey: 'punchy',
  aspect: '9:16'
};

/** Whether the Roots bottom-sheet UI is open. */
export const rootsOpen = writable<boolean>(false);

/** The working scene (editable in the sheet, serialized to a share-link). */
export const rootsScene = writable<RootsScene>({ ...DEFAULT_SCENE });

/** True while a Roots Reel is rendering (mirrors recordingMode for its own chrome). */
export const rootsRendering = writable<boolean>(false);

/** 0..1 determinate render progress. */
export const rootsProgress = writable<number>(0);

/** Convenience reset (used when closing the sheet on a fresh start). */
export function resetRootsScene(): void {
  rootsScene.set({ ...DEFAULT_SCENE });
}
