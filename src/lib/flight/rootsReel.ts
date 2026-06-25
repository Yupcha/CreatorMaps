/**
 * Roots Reel — the staged "space → rooftop" descent and target resolution.
 *
 * Built directly on maplibre's flyTo (the same primitive CinematicBar uses) so
 * NO extraction/refactor of CinematicBar is required — this module owns its own
 * self-contained camera choreography and the existing flight engine is left
 * untouched. The descent is a five-leg dive (see `rootsKeyframes.ts`): each leg
 * awaits both `moveend` and tile-load (plus a satellite settle) so no blank /
 * half-loaded frame is ever captured, then a rAF-timed FINAL BREATH keeps the
 * held name card alive.
 *
 * Coordinates: state objects carry NO lat/lng, so a target name is resolved to
 * coordinates via (1) a known `indianLocations` entry (best — carries tuned
 * zoom/pitch/bearing), (2) the loaded district GeoJSON centroid matched on
 * `_normalizedState`, (3) the state's capital city in `indianCities`, finally
 * (4) INDIA_CENTER. Centroids are memoized by normalized state name.
 *
 * Pure of Svelte; callers wrap in try/finally (the Foundation recorder already
 * does). Abort-aware: pass the AbortSignal the recorder hands `runAnimation`.
 */

import type { Map as MapLibreMap, FlyToOptions } from 'maplibre-gl';
import centroid from '@turf/centroid';
import { loadIndiaGeoJSON, getStateData } from '$lib/stores/indiaGeoStore';
import { normalizeStateName, INDIA_CENTER } from '$lib/data/indiaConstants';
import { findCity } from '$lib/data/indianCities';
import { searchLocations, type IndianLocation } from '$lib/data/indianLocations';
import {
  ROOTS_LEGS,
  FINAL_BREATH,
  SPACE_HOLD_MS,
  SATELLITE_SETTLE_MS,
  computeLegDurations,
  type RootsTier
} from './rootsKeyframes';

// ─── Target ──────────────────────────────────────────────────────────────────

export interface RootsTarget {
  lng: number;
  lat: number;
  /** Display name shown as the final tier label / title. */
  name: string;
  /** State (UT) name — used for the L2 centroid and the "STATE" tier label. */
  state: string;
  /** Optional district label for the L3 tier ("DISTRICT" label fallback = state). */
  district?: string;
  /** Override the generic final-leg numbers (from a known indianLocations entry). */
  finalZoom?: number;
  finalPitch?: number;
  finalBearing?: number;
  /** Centroid of the home STATE (for L2 framing); falls back to the point. */
  stateLng?: number;
  stateLat?: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const aborted = (s?: AbortSignal) => !!s?.aborted;

/** flyTo + moveend (resolves early if aborted so the caller can bail). */
function flyToAsync(map: MapLibreMap, options: FlyToOptions, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (aborted(signal)) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      map.off('moveend', finish);
      resolve();
    };
    map.flyTo(options);
    map.once('moveend', finish);
    // Safety: never hang past the requested duration + a slack tail.
    setTimeout(finish, (options.duration ?? 1000) + 1200);
    signal?.addEventListener('abort', finish, { once: true });
  });
}

/** Wait until visible tiles are fully loaded — prevents blank/blur capture. */
function waitForTilesLoaded(map: MapLibreMap, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (aborted(signal) || (map as any).areTilesLoaded?.()) {
      resolve();
      return;
    }
    const check = () => {
      if ((map as any).areTilesLoaded?.()) {
        map.off('sourcedata', check);
        resolve();
      }
    };
    map.on('sourcedata', check);
    setTimeout(() => {
      map.off('sourcedata', check);
      resolve();
    }, 5000);
    signal?.addEventListener(
      'abort',
      () => {
        map.off('sourcedata', check);
        resolve();
      },
      { once: true }
    );
  });
}

// ─── State centroid resolution (memoized) ───────────────────────────────────────

const centroidCache = new Map<string, [number, number]>();

/**
 * Centroid [lng,lat] of a state from the loaded district GeoJSON, matched on
 * the injected `_normalizedState`. Memoized by normalized name. Returns null if
 * the GeoJSON is unavailable or no feature matches.
 */
async function resolveStateCentroid(stateName: string): Promise<[number, number] | null> {
  const norm = normalizeStateName(stateName);
  if (!norm) return null;
  const cached = centroidCache.get(norm);
  if (cached) return cached;

  const geo = await loadIndiaGeoJSON(); // idempotent + in-memory cached
  if (!geo) return null;

  const matches = geo.features.filter((f) => (f.properties as any)?._normalizedState === norm);
  if (matches.length === 0) return null;

  // Average the per-feature centroids so a multi-district state lands central.
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const f of matches) {
    try {
      const c = centroid(f as any);
      const [lng, lat] = c.geometry.coordinates;
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        sx += lng;
        sy += lat;
        n++;
      }
    } catch {
      /* skip malformed feature */
    }
  }
  if (n === 0) return null;
  const result: [number, number] = [sx / n, sy / n];
  centroidCache.set(norm, result);
  return result;
}

// ─── Target resolution ─────────────────────────────────────────────────────────

/**
 * Turn a known `indianLocations` entry OR a free place name + state into a
 * fully-resolved RootsTarget (point coords + state centroid + final camera).
 *
 * Resolution order for the POINT:
 *   1. an explicit { lng, lat } already on the input,
 *   2. a matching `indianLocations` entry (also supplies tuned final camera),
 *   3. the capital city of the state via `indianCities`,
 *   4. INDIA_CENTER (never throws — last-resort so a render still produces).
 */
export async function resolveRootsTarget(input: {
  name: string;
  state?: string;
  lng?: number;
  lat?: number;
  finalZoom?: number;
  finalPitch?: number;
  finalBearing?: number;
}): Promise<RootsTarget> {
  let { lng, lat } = input;
  const name = input.name?.trim() || 'Home';
  let state = input.state?.trim() || '';
  let finalZoom = input.finalZoom;
  let finalPitch = input.finalPitch;
  let finalBearing = input.finalBearing;

  // (2) Known location entry — best source: tuned zoom/pitch/bearing.
  if (lng == null || lat == null) {
    const known: IndianLocation | undefined =
      searchLocations(name).find((l) => l.name.toLowerCase() === name.toLowerCase()) ??
      searchLocations(name)[0];
    if (known) {
      lng = known.lng;
      lat = known.lat;
      if (!state && known.state) state = known.state;
      finalZoom ??= known.zoom;
      finalPitch ??= known.pitch;
      finalBearing ??= known.bearing;
    }
  }

  // (3) Capital city fallback.
  if (lng == null || lat == null) {
    const capName = state ? getStateData(normalizeStateName(state))?.capital : undefined;
    const city = capName ? findCity(capName) : findCity(name);
    if (city) {
      lng = city.lng;
      lat = city.lat;
      if (!state) state = city.state;
    }
  }

  // (4) Last-resort: India center (never crash on an unknown place).
  if (lng == null || lat == null) {
    [lng, lat] = INDIA_CENTER;
  }

  // State centroid for the L2 framing (capital/point fallback inside descent).
  let stateLng: number | undefined;
  let stateLat: number | undefined;
  if (state) {
    const c = await resolveStateCentroid(state);
    if (c) {
      [stateLng, stateLat] = c;
    } else {
      const capName = getStateData(normalizeStateName(state))?.capital;
      const capCity = capName ? findCity(capName) : undefined;
      if (capCity) {
        stateLng = capCity.lng;
        stateLat = capCity.lat;
      }
    }
  }

  return {
    lng: lng!,
    lat: lat!,
    name,
    state: state || 'India',
    finalZoom,
    finalPitch,
    finalBearing,
    stateLng,
    stateLat
  };
}

// ─── The descent ─────────────────────────────────────────────────────────────────

/** Human-facing label for each tier (drives the eyebrow line in the overlay). */
function tierLabel(tier: RootsTier, target: RootsTarget): string {
  switch (tier) {
    case 'space':
      return 'From space';
    case 'country':
      return 'India';
    case 'state':
      return target.state;
    case 'district':
      return target.district || target.state;
    case 'point':
      return target.name;
  }
}

/** Where each leg's camera should be centered. */
function legCenter(tier: RootsTier, target: RootsTarget): [number, number] {
  if (tier === 'state' && target.stateLng != null && target.stateLat != null) {
    return [target.stateLng, target.stateLat];
  }
  // country/space frame on the country center but keep the point in view as we go.
  if (tier === 'space' || tier === 'country') {
    return [INDIA_CENTER[0], (INDIA_CENTER[1] + target.lat) / 2];
  }
  return [target.lng, target.lat];
}

export interface RootsDescentOptions {
  totalMs: number;
  signal?: AbortSignal;
  /** Fired at each leg start — drive the overlay tier label / progress. */
  onPhase?: (tier: RootsTier, label: string) => void;
}

/**
 * Run the full space→rooftop descent. Resolves when the camera has finished the
 * FINAL BREATH hold (or immediately if aborted). Awaits tile-load between legs.
 */
export async function runRootsDescent(
  map: MapLibreMap,
  target: RootsTarget,
  opts: RootsDescentOptions
): Promise<void> {
  const { totalMs, signal, onPhase } = opts;
  const legMs = computeLegDurations(totalMs);

  // Pre-position on the space shot WITHOUT animating, then a steady opening hold.
  const space = ROOTS_LEGS[0];
  map.jumpTo({ center: legCenter('space', target), zoom: space.zoom, pitch: space.pitch, bearing: space.bearing });
  onPhase?.('space', tierLabel('space', target));
  await waitForTilesLoaded(map, signal);
  if (aborted(signal)) return;
  await wait(SPACE_HOLD_MS);

  for (let i = 1; i < ROOTS_LEGS.length; i++) {
    if (aborted(signal)) return;
    const leg = ROOTS_LEGS[i];
    const isFinal = i === ROOTS_LEGS.length - 1;

    onPhase?.(leg.tier, tierLabel(leg.tier, target));

    const center = legCenter(leg.tier, target);
    const zoom = isFinal && target.finalZoom != null ? target.finalZoom : leg.zoom;
    const pitch = isFinal && target.finalPitch != null ? target.finalPitch : leg.pitch;
    const bearing = isFinal && target.finalBearing != null ? target.finalBearing : leg.bearing;

    await flyToAsync(
      map,
      {
        center,
        zoom,
        pitch,
        bearing,
        curve: leg.curve,
        duration: legMs[i],
        essential: true
      },
      signal
    );
    await waitForTilesLoaded(map, signal);
    if (aborted(signal)) return;
    await wait(SATELLITE_SETTLE_MS);
  }

  // ── FINAL BREATH: living held card (bearing creep + sine pitch bob) ──
  await runFinalBreath(map, signal);
}

/** rAF-timed gentle bearing creep + sine pitch bob over FINAL_BREATH.holdMs. */
function runFinalBreath(map: MapLibreMap, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (aborted(signal)) {
      resolve();
      return;
    }
    const startBearing = map.getBearing();
    const startPitch = map.getPitch();
    const t0 = performance.now();
    const { holdMs, bearingDelta, pitchBob } = FINAL_BREATH;

    const step = () => {
      if (aborted(signal)) {
        resolve();
        return;
      }
      const t = Math.min(1, (performance.now() - t0) / holdMs);
      map.setBearing(startBearing + bearingDelta * t);
      map.setPitch(Math.min(85, startPitch + Math.sin(t * Math.PI) * pitchBob));
      if (t >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
