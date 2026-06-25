/**
 * Data Reel orchestrator — binds the pure timeline to the live map (staggered
 * setFeatureState reveal) and to the shared recorder (offscreen 2D compositor).
 *
 * DESIGN
 *  - ONE rAF clock drives everything (no setTimeout chains → no drift).
 *  - On-map reveal uses map.setFeatureState({source, id}, { reveal }) ONLY —
 *    fill-COLOR stays the static choropleth; only the opacity term animates
 *    (via the extended fill-opacity expression in MapCanvas). No per-frame
 *    expression rebuilds (which recompile 36 branches and stutter).
 *  - Camera is a static fitBounds(INDIA_BOUNDS) with an OPTIONAL cheap slow
 *    bearing drift (setBearing only — no flyTo, no tile streaming).
 *  - The global overlayMetric store is NEVER mutated (reel uses its snapshot).
 */

import { get } from 'svelte/store';
import type { Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl';
import { INDIA_BOUNDS, type OverlayMetric } from '$lib/data/indiaConstants';
import { recordReel, type RecordReelResult } from '$lib/reels';
import {
  buildDataReelKeyframes,
  sampleReel,
  type ReelTimeline,
  type ReelViewModel
} from './dataReelTimeline';
import { drawDataReelOverlay, type DataReelOverlayOpts } from './dataReelOverlay';

const SOURCE_ID = 'india-states';
const FILL_LAYER = 'india-states-fill';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolve once when the map view is idle (tiles drawn). */
function waitForIdle(map: MapLibreMap, timeoutMs = 4000): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      map.off('idle', finish);
      resolve();
    };
    try {
      if ((map as unknown as { areTilesLoaded?: () => boolean }).areTilesLoaded?.()) {
        finish();
        return;
      }
    } catch {
      /* ignore */
    }
    map.on('idle', finish);
    setTimeout(finish, timeoutMs);
  });
}

/**
 * Because the GeoJSON is district-level, ONE state maps to MANY feature ids.
 * We collect ALL ids per normalized state so the whole state lights up.
 */
function buildAllIdsMap(map: MapLibreMap): Map<string, number[]> {
  const byName = new Map<string, number[]>();
  let feats: MapGeoJSONFeature[] = [];
  try {
    feats = map.querySourceFeatures(SOURCE_ID) as MapGeoJSONFeature[];
  } catch {
    feats = [];
  }
  for (const f of feats) {
    const name = (f.properties?._normalizedState as string) || '';
    if (!name || f.id === undefined || f.id === null) continue;
    const id = Number(f.id);
    const arr = byName.get(name);
    if (arr) {
      if (!arr.includes(id)) arr.push(id);
    } else {
      byName.set(name, [id]);
    }
  }
  return byName;
}

export interface PlayReelOptions {
  map: MapLibreMap;
  timeline: ReelTimeline;
  /** Optional slow bearing drift (−12° → +12°) during the reveal. */
  drift?: boolean;
  /** Called every frame with the sampled view-model (drives preview/overlay). */
  onTick?: (vm: ReelViewModel, elapsedMs: number) => void;
  /** Abort the playback. */
  signal?: AbortSignal;
}

/**
 * Run the rAF clock: fit bounds, reset all reveals to 0, then per frame ramp
 * each entered state's reveal via setFeatureState and emit the sampled VM.
 * Resolves when the clock reaches durationMs (or aborts).
 */
export async function playReel(opts: PlayReelOptions): Promise<void> {
  const { map, timeline, onTick, signal } = opts;
  const drift = opts.drift ?? false;
  const durationMs = timeline.durationMs;

  // 1) static establishing camera
  map.fitBounds(INDIA_BOUNDS, { padding: 40, pitch: 0, bearing: drift ? -12 : 0, duration: 0 });
  await waitForIdle(map);

  // 2) reset all reveals to 0 (so states pop in, not start lit)
  const idsByName = buildAllIdsMap(map);
  const setReveal = (name: string, reveal: number) => {
    const ids = idsByName.get(name);
    if (!ids) return;
    for (const id of ids) {
      try {
        map.setFeatureState({ source: SOURCE_ID, id }, { reveal });
      } catch {
        /* feature may not be present yet */
      }
    }
  };
  // start everything dark
  for (const name of idsByName.keys()) setReveal(name, 0);

  // track last applied reveal per state to avoid redundant setFeatureState
  const lastReveal = new Map<string, number>();

  return new Promise<void>((resolve) => {
    let rafId = 0;
    const start = performance.now();

    const stop = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      resolve();
    };
    if (signal) {
      if (signal.aborted) {
        stop();
        return;
      }
      signal.addEventListener('abort', stop, { once: true });
    }

    const frame = () => {
      if (signal?.aborted) {
        stop();
        return;
      }
      const t = performance.now() - start;
      const vm = sampleReel(timeline, t);

      // drive on-map reveal from the sampled rows (revealAlpha 0..1.08)
      for (const row of vm.rows) {
        const a = Math.min(1, row.revealAlpha); // map opacity term caps at 1
        const prev = lastReveal.get(row.normalizedName);
        if (prev === undefined || Math.abs(prev - a) > 0.01) {
          setReveal(row.normalizedName, a);
          lastReveal.set(row.normalizedName, a);
        }
      }

      // optional cheap bearing drift (setBearing only)
      if (drift) {
        const dp = Math.min(1, t / durationMs);
        map.setBearing(-12 + dp * 24);
      }

      onTick?.(vm, t);

      if (t >= durationMs) {
        stop();
        return;
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
  });
}

/** Clear all reveal feature-state so the live map returns to normal. */
export function clearReveal(map: MapLibreMap): void {
  try {
    map.removeFeatureState({ source: SOURCE_ID });
  } catch {
    /* ignore — source may be gone */
  }
}

export interface BuildTimelineOptions {
  metric: OverlayMetric;
  topN: number;
  durationMs: number;
  bpm: number;
  beatsPerState: number;
}

export function buildTimeline(o: BuildTimelineOptions): ReelTimeline {
  return buildDataReelKeyframes(o);
}

export interface RecordReelExportOptions {
  map: MapLibreMap;
  timeline: ReelTimeline;
  width: number;
  height: number;
  overlay: Omit<DataReelOverlayOpts, 'width' | 'height'>;
  drift?: boolean;
  fileBaseName?: string;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

/**
 * Record the reel to a downloadable video (or PNG fallback). Wires playReel's
 * onTick into the recorder's drawOverlay so the composited frame always shows
 * the current leaderboard. resizeContainer:false — static camera, the
 * compositor center-crops to the target aspect (no flicker, no tile waits).
 */
export async function recordDataReel(opts: RecordReelExportOptions): Promise<RecordReelResult> {
  const { map, timeline, width, height, overlay, drift, fileBaseName, onProgress, signal } = opts;
  const overlayOpts: DataReelOverlayOpts = { ...overlay, width, height };

  // shared latest VM between the playReel clock and the recorder's draw loop
  let latestVM: ReelViewModel = sampleReel(timeline, 0);

  try {
    const result = await recordReel({
      map,
      width,
      height,
      durationMs: timeline.durationMs,
      resizeContainer: false,
      fileBaseName: fileBaseName ?? 'yupcha-data-reel',
      signal,
      onProgress,
      runAnimation: async (sig) => {
        await playReel({
          map,
          timeline,
          drift,
          signal: sig,
          onTick: (vm) => {
            latestVM = vm;
          }
        });
      },
      drawOverlay: (ctx) => {
        drawDataReelOverlay(ctx, latestVM, overlayOpts);
      }
    });
    return result;
  } finally {
    clearReveal(map);
  }
}
