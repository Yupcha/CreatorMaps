/**
 * Shared, parametrized flight engine — extracted from CinematicBar's inline
 * `runFlightChoreography` so multiple features (Trip Reel, and eventually the
 * Cinematic Bar itself) drive the camera from ONE place.
 *
 * The 6 legacy styles (flythrough/orbit/dronerise/tracking/timelapse/parallax)
 * are moved VERBATIM from CinematicBar.svelte — the ONLY change is the switch
 * reads `opts.style` instead of the component-local `activeFlightStyle` closure.
 * A new `triproute` style delegates to the Trip Reel choreography.
 *
 * Every style:
 *  - awaits {@link waitForTilesLoaded} after camera moves (no blank frames),
 *  - checks `opts.signal?.aborted` at the top of every step loop and early-
 *    returns so a Stop kills motion within one step.
 *
 * NOTE: CinematicBar.svelte is intentionally NOT edited by this feature (HARD
 * RULE). The integrationSpec describes the in-place refactor so the Cinematic
 * Bar can adopt this engine and gain the `triproute` style.
 */

import * as turf from '@turf/turf';
import type { Map as MapLibreMap, FlyToOptions } from 'maplibre-gl';
import {
  buildTripTimeline,
  runTripChoreography,
  type TripTimeline,
  type TripStop
} from './tripChoreography';
import {
  addRouteLayers,
  removeRouteLayers
} from './tripRoute';

export type FlightStyle =
  | 'flythrough'
  | 'orbit'
  | 'dronerise'
  | 'tracking'
  | 'timelapse'
  | 'parallax'
  | 'triproute';

/** A waypoint with resolved coordinates (CinematicBar's Waypoint subset). */
export interface FlightWaypoint {
  lng: number;
  lat: number;
  /** Optional name/state (used by triproute stamps). */
  name?: string;
  state?: string;
  zoom?: number;
  pitch?: number;
  bearing?: number;
}

export interface RunFlightOptions {
  style: FlightStyle;
  totalMs: number;
  signal?: AbortSignal;
  onProgress?: (t: number) => void;
  /**
   * For 'triproute': pre-built timeline so the recorder/compositor share the
   * exact stamp schedule. If omitted it is built internally (preview path).
   */
  tripTimeline?: TripTimeline;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** flyTo wrapped in a promise that resolves on moveend. */
export function flyToAsync(map: MapLibreMap, options: FlyToOptions): Promise<void> {
  return new Promise((resolve) => {
    map.flyTo(options);
    map.once('moveend', () => resolve());
  });
}

/** Wait until all visible tiles are fully loaded — prevents blank/blur frames. */
export function waitForTilesLoaded(map: MapLibreMap): Promise<void> {
  return new Promise((resolve) => {
    if (map.areTilesLoaded()) {
      resolve();
      return;
    }
    const check = () => {
      if (map.areTilesLoaded()) {
        map.off('sourcedata', check);
        resolve();
      }
    };
    map.on('sourcedata', check);
    setTimeout(() => {
      map.off('sourcedata', check);
      resolve();
    }, 5000);
  });
}

/**
 * Drive the camera through `waypoints` for `opts.totalMs` in the given style.
 * The 6 legacy cases are byte-for-byte the CinematicBar logic with `opts.style`
 * swapped in for the closure variable.
 */
export async function runFlight(
  map: MapLibreMap,
  waypoints: FlightWaypoint[],
  opts: RunFlightOptions
): Promise<void> {
  const { style, totalMs, signal, onProgress } = opts;
  const aborted = () => signal?.aborted ?? false;
  const n = waypoints.length;
  const perPointMs = totalMs / n;

  // ── triproute: the Trip Reel signature flight ──
  if (style === 'triproute') {
    const stops: TripStop[] = waypoints.map((w) => ({
      name: w.name ?? '',
      state: w.state ?? '',
      lng: w.lng,
      lat: w.lat,
      zoom: w.zoom,
      pitch: w.pitch,
      bearing: w.bearing
    }));
    const timeline = opts.tripTimeline ?? buildTripTimeline(stops, totalMs);
    addRouteLayers(map, timeline.geo);
    try {
      await runTripChoreography(map, stops, timeline, signal, onProgress);
    } finally {
      removeRouteLayers(map);
    }
    return;
  }

  switch (style) {
    case 'orbit':
      for (const wp of waypoints) {
        if (aborted()) return;
        await flyToAsync(map, { center: [wp.lng, wp.lat], zoom: 13, pitch: 60, bearing: 0, duration: perPointMs * 0.3, essential: true });
        await waitForTilesLoaded(map);
        const steps = 60;
        for (let s = 0; s < steps; s++) {
          if (aborted()) return;
          map.setBearing((360 / steps) * (s + 1));
          await wait((perPointMs * 0.7) / steps);
        }
      }
      break;

    case 'dronerise':
      for (const wp of waypoints) {
        if (aborted()) return;
        await flyToAsync(map, { center: [wp.lng, wp.lat], zoom: 16, pitch: 80, bearing: 0, duration: perPointMs * 0.2, essential: true });
        await waitForTilesLoaded(map);
        if (aborted()) return;
        await flyToAsync(map, { center: [wp.lng, wp.lat], zoom: 8, pitch: 30, bearing: 45, duration: perPointMs * 0.8, essential: true });
        await waitForTilesLoaded(map);
      }
      break;

    case 'tracking': {
      const coords = waypoints.map((w) => [w.lng, w.lat]);
      const line = turf.lineString(coords);
      const curved = turf.bezierSpline(line, { resolution: 10000 });
      const totalLength = turf.length(curved);
      const steps = Math.round(totalMs / 50);
      const startPt = turf.along(curved, 0);
      map.jumpTo({ center: startPt.geometry.coordinates as [number, number], zoom: 13, pitch: 65 });
      await waitForTilesLoaded(map);
      for (let s = 0; s <= steps; s++) {
        if (aborted()) return;
        const dist = (s / steps) * totalLength;
        const pt = turf.along(curved, dist);
        const [lng, lat] = pt.geometry.coordinates;
        const nextDist = Math.min(dist + 0.5, totalLength);
        const nextPt = turf.along(curved, nextDist);
        const bearing = turf.bearing(pt, nextPt);
        map.jumpTo({ center: [lng, lat], zoom: 13, pitch: 65, bearing });
        onProgress?.(s / steps);
        await wait(50);
      }
      break;
    }

    case 'timelapse':
      for (const wp of waypoints) {
        if (aborted()) return;
        await flyToAsync(map, { center: [wp.lng, wp.lat], zoom: 3, pitch: 0, bearing: 0, duration: 500, essential: true });
        await waitForTilesLoaded(map);
        if (aborted()) return;
        await flyToAsync(map, { center: [wp.lng, wp.lat], zoom: 14, pitch: 60, bearing: 30, duration: perPointMs - 500, essential: true });
        await waitForTilesLoaded(map);
        await wait(800);
      }
      break;

    case 'parallax':
      for (let i = 0; i < n; i++) {
        if (aborted()) return;
        const wp = waypoints[i];
        const bearingBase = i * 40;
        await flyToAsync(map, { center: [wp.lng, wp.lat], zoom: 12, pitch: 55, bearing: bearingBase, duration: perPointMs * 0.4, essential: true });
        await waitForTilesLoaded(map);
        const driftSteps = 40;
        for (let s = 0; s < driftSteps; s++) {
          if (aborted()) return;
          map.setBearing(bearingBase + Math.sin(s / 5) * 15);
          map.setPitch(55 + Math.sin(s / 8) * 8);
          await wait((perPointMs * 0.6) / driftSteps);
        }
      }
      break;

    default: // flythrough
      for (let i = 0; i < n; i++) {
        if (aborted()) return;
        const wp = waypoints[i];
        const pitch = i === 0 ? 60 : i === n - 1 ? 40 : 55;
        let bearing = 0;
        if (i < n - 1) {
          const next = waypoints[i + 1];
          bearing = turf.bearing(turf.point([wp.lng, wp.lat]), turf.point([next.lng, next.lat]));
        }
        await flyToAsync(map, { center: [wp.lng, wp.lat], zoom: 11.5, pitch, bearing, speed: 0.3, curve: 1.2, essential: true, duration: i === 0 ? perPointMs * 0.3 : perPointMs * 0.8 });
        await waitForTilesLoaded(map);
        await wait(1000);
      }
  }
  onProgress?.(1);
}
