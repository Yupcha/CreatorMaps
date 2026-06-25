/**
 * Shared reel foundation store (classic svelte/store writables — matches
 * mapStore/indiaGeoStore conventions, NOT runes).
 *
 * Holds cross-cutting export config every reel/poster feature reads:
 * aspect ratio, resolution tier, watermark toggle, overlay title/subtitle, and
 * a live render-progress channel for determinate progress UI.
 *
 * Feature-specific state (roots place, trip stops, data metric, poster dims)
 * lives in each feature's OWN store — this is only the shared surface.
 */

import { writable } from 'svelte/store';
import type { AspectKey, ResolutionKey } from '../aspect';
import type { ReelFeature } from '../sceneLink';

/** Output aspect for the next export. Default 9:16 (vertical, viral-first). */
export const reelAspect = writable<AspectKey>('9:16');

/** Quality tier. Default full-HD (1080 short edge). */
export const reelResolution = writable<ResolutionKey>('fhd');

/** Whether the "Yupcha Maps" watermark is composited into exports. */
export const reelWatermark = writable<boolean>(true);

/** Optional overlay title / subtitle shared by the simple reel UIs. */
export const reelTitle = writable<string>('');
export const reelSubtitle = writable<string>('');

/** True while an export render is in flight (drives the render overlay). */
export const reelRendering = writable<boolean>(false);

/** Determinate render progress, 0..1. */
export const reelProgress = writable<number>(0);

/**
 * Which feature, if any, was requested via a decoded scene-link on load.
 * +page.svelte sets this after decoding so the matching feature can open.
 */
export const pendingSceneFeature = writable<ReelFeature | null>(null);
