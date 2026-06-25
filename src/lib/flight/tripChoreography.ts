/**
 * The `triproute` choreography — Trip Reel's signature flight.
 *
 * Built on the proven `tracking` loop (turf.along the bezier + per-step jumpTo)
 * but upgraded to feel premium:
 *  - TAKEOFF: fit the whole route bbox first (easeInOutQuart) — "here is the
 *    journey" — over ~10% of the total time.
 *  - TRAVEL (per leg): step along the bezier at ~50ms (20 logical fps; maplibre
 *    interpolates to display rate — we do NOT chase 60 discrete jumps), progress
 *    pushed through easeInOutSine so the camera accelerates out of / decelerates
 *    into each stop. Cruise zoom 10 / pitch 55 (9.5 / 62 over mountain states).
 *    Heading from a 1.5km-ahead point, low-pass filtered (alpha 0.12) so it
 *    glides instead of snapping on curves.
 *  - ARRIVAL: a single easeOutCubic flyTo descending to zoom 12.5 / pitch 60
 *    (or the stop's curated indianLocations zoom/pitch/bearing when matched).
 *  - DWELL: a tiny parallax oscillation (bearing ±8°, pitch ±4°) so the frame
 *    breathes under the landed stamp. NO dead setTimeout holds.
 *
 * TIMING is LENGTH-WEIGHTED: each travel leg gets a share of the travel budget
 * proportional to its turf.length, floored at 1500ms then renormalized so short
 * final legs don't whip. Stamp reveal/hold/fade windows are emitted on a
 * StampTimeline the compositor reads each frame.
 *
 * Honors an AbortSignal at the top of every loop so Stop kills motion within
 * one step.
 */

import * as turf from '@turf/turf';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { easeOutCubic, easeInOutSine, easeInOutQuart, lowPassBearing } from './easing';
import {
  buildRoute,
  setRouteProgress,
  type TripStop,
  type TripRouteGeometry,
  type StampEvent
} from './tripRoute';

export type { TripStop } from './tripRoute';
import { indianLocations } from '$lib/data/indianLocations';

const MOUNTAIN_STATES = new Set([
  'Ladakh',
  'Himachal Pradesh',
  'Uttarakhand',
  'Goa',
  'Kerala',
  'Jammu & Kashmir',
  'Sikkim'
]);

const TAKEOFF_FRACTION = 0.1;
const DWELL_PER_STOP_MS = 1800; // within the 1500–2500 band
const MIN_LEG_MS = 1500;
const STEP_MS = 50;
const LOOKAHEAD_KM = 1.5;
const STAMP_FADE_MS = 250;
const STAMP_FADE_OUT_MS = 300;

/** A resolved stamp window the compositor queries each frame. */
export interface StampWindow extends StampEvent {
  /** Absolute ms (from flight start) the stamp begins fading in. */
  startMs: number;
  /** Absolute ms the stamp begins fading out. */
  fadeOutMs: number;
  /** Absolute ms the stamp is fully gone. */
  endMs: number;
}

/**
 * Live, mutable handle the recorder/compositor reads each frame to drive the
 * route reveal float and the active stamp. The choreography writes to it; the
 * overlay reads from it. Single source of truth, no event plumbing.
 */
export interface TripTimeline {
  geo: TripRouteGeometry;
  stampWindows: StampWindow[];
  /** Current route reveal fraction 0..1 (written every step). */
  routeProgress: number;
  /** Total flight ms. */
  totalMs: number;
  /**
   * Resolve the stamp visible at `elapsedMs` plus its 0..1 alpha
   * (fade-in → hold → fade-out). Returns null when between stamps.
   */
  activeStampAt(elapsedMs: number): { stamp: StampWindow; alpha: number } | null;
}

interface LegPlan {
  fromIdx: number;
  toIdx: number;
  startKm: number;
  endKm: number;
  travelMs: number;
  /** Absolute ms this leg's travel begins. */
  travelStartMs: number;
  /** Absolute ms this leg's arrival ease begins. */
  arriveStartMs: number;
  arriveMs: number;
  dwellMs: number;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function matchLocation(stop: TripStop) {
  return indianLocations.find((l) => l.name.toLowerCase() === stop.name.toLowerCase());
}

/** Plan length-weighted leg/arrival/dwell timing for the whole route. */
function planTiming(stops: TripStop[], geo: TripRouteGeometry, totalMs: number): LegPlan[] {
  const n = stops.length;
  const legCount = n - 1;
  const takeoffMs = totalMs * TAKEOFF_FRACTION;
  const arriveMs = 1200; // per-stop landing ease
  const dwellTotal = DWELL_PER_STOP_MS * n;
  const arriveTotal = arriveMs * legCount;

  let travelBudget = totalMs - takeoffMs - dwellTotal - arriveTotal;
  if (travelBudget < MIN_LEG_MS * legCount) travelBudget = MIN_LEG_MS * legCount;

  // length-weighted shares with a floor, then renormalize
  const legKm: number[] = [];
  for (let i = 0; i < legCount; i++) {
    legKm.push(Math.max(0.001, geo.cumKmAtStop[i + 1] - geo.cumKmAtStop[i]));
  }
  const sumKm = legKm.reduce((a, b) => a + b, 0);
  let raw = legKm.map((km) => Math.max(MIN_LEG_MS, (km / sumKm) * travelBudget));
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const scale = travelBudget / rawSum;
  // only scale DOWN the floored ones proportionally if we overran
  const travelMs = scale < 1 ? raw.map((v) => Math.max(MIN_LEG_MS, v * scale)) : raw;

  const plans: LegPlan[] = [];
  // origin dwell happens during takeoff settle — first travel starts after takeoff
  let cursor = takeoffMs + DWELL_PER_STOP_MS;
  for (let i = 0; i < legCount; i++) {
    const travelStartMs = cursor;
    const arriveStartMs = travelStartMs + travelMs[i];
    cursor = arriveStartMs + arriveMs + DWELL_PER_STOP_MS;
    plans.push({
      fromIdx: i,
      toIdx: i + 1,
      startKm: geo.cumKmAtStop[i],
      endKm: geo.cumKmAtStop[i + 1],
      travelMs: travelMs[i],
      travelStartMs,
      arriveStartMs,
      arriveMs,
      dwellMs: DWELL_PER_STOP_MS
    });
  }
  return plans;
}

/**
 * Build the timeline (geometry + stamp windows) WITHOUT running the camera.
 * The recorder needs this up front so the compositor can paint stamps that are
 * perfectly synced to the camera clock.
 */
export function buildTripTimeline(stops: TripStop[], totalMs: number): TripTimeline {
  const geo = buildRoute(stops);
  const plans = planTiming(stops, geo, totalMs);

  const stampWindows: StampWindow[] = geo.stamps.map((stamp) => {
    if (stamp.stopIndex === 0) {
      // origin stamp lands right after takeoff settle
      const start = totalMs * TAKEOFF_FRACTION;
      const fadeOut = start + DWELL_PER_STOP_MS - STAMP_FADE_OUT_MS;
      return { ...stamp, startMs: start, fadeOutMs: fadeOut, endMs: start + DWELL_PER_STOP_MS };
    }
    const plan = plans[stamp.stopIndex - 1];
    const start = plan.arriveStartMs; // stamp lands as arrival ease begins
    const end = plan.arriveStartMs + plan.arriveMs + plan.dwellMs;
    return { ...stamp, startMs: start, fadeOutMs: end - STAMP_FADE_OUT_MS, endMs: end };
  });

  const timeline: TripTimeline = {
    geo,
    stampWindows,
    routeProgress: 0,
    totalMs,
    activeStampAt(elapsedMs: number) {
      for (const sw of stampWindows) {
        if (elapsedMs < sw.startMs || elapsedMs >= sw.endMs) continue;
        let alpha: number;
        if (elapsedMs < sw.startMs + STAMP_FADE_MS) {
          alpha = (elapsedMs - sw.startMs) / STAMP_FADE_MS;
        } else if (elapsedMs >= sw.fadeOutMs) {
          alpha = 1 - (elapsedMs - sw.fadeOutMs) / STAMP_FADE_OUT_MS;
        } else {
          alpha = 1;
        }
        return { stamp: sw, alpha: Math.max(0, Math.min(1, alpha)) };
      }
      return null;
    }
  };
  return timeline;
}

/**
 * Run the triproute camera flight. `timeline.routeProgress` is updated every
 * step (the compositor reads it to reveal the line). Resolves when the flight
 * completes or the signal aborts.
 */
export async function runTripChoreography(
  map: MapLibreMap,
  stops: TripStop[],
  timeline: TripTimeline,
  signal?: AbortSignal,
  onProgress?: (t: number) => void
): Promise<void> {
  const { geo, totalMs } = timeline;
  const plans = planTiming(stops, geo, totalMs);
  const aborted = () => signal?.aborted ?? false;
  const flightStart = performance.now();
  const reportClock = () => {
    if (onProgress) onProgress(Math.min(1, (performance.now() - flightStart) / totalMs));
  };

  const mountains = stops.some((s) => MOUNTAIN_STATES.has(s.state));
  const cruiseZoom = mountains ? 9.5 : 10;
  const cruisePitch = mountains ? 62 : 55;

  // ── TAKEOFF: fit the whole route bbox (easeInOutQuart) ──
  const bbox = turf.bbox(geo.curved) as [number, number, number, number];
  await new Promise<void>((resolve) => {
    if (aborted()) return resolve();
    map.once('moveend', () => resolve());
    map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
      // generous top/bottom padding so the route reads inside 9:16 safe zones
      padding: { top: 220, bottom: 320, left: 80, right: 80 },
      pitch: 25,
      bearing: 0,
      duration: totalMs * TAKEOFF_FRACTION,
      easing: easeInOutQuart,
      essential: true
    });
  });
  await waitForTiles(map);
  reportClock();

  // origin dwell (small breathe before the first leg) — keep the route hidden
  setRouteProgress(map, 0);
  timeline.routeProgress = 0;
  await dwell(map, map.getBearing(), map.getPitch(), DWELL_PER_STOP_MS, aborted, reportClock);

  let prevBearing = map.getBearing();

  for (const plan of plans) {
    if (aborted()) break;
    const legLengthKm = plan.endKm - plan.startKm;
    const steps = Math.max(1, Math.round(plan.travelMs / STEP_MS));

    // ── TRAVEL ──
    for (let s = 0; s <= steps; s++) {
      if (aborted()) break;
      const linT = s / steps;
      const eased = easeInOutSine(linT);
      const distKm = plan.startKm + eased * legLengthKm;
      const pt = turf.along(geo.curved, distKm, { units: 'kilometers' });
      const [lng, lat] = pt.geometry.coordinates;

      const aheadKm = Math.min(distKm + LOOKAHEAD_KM, geo.totalLengthKm);
      const aheadPt = turf.along(geo.curved, aheadKm, { units: 'kilometers' });
      const targetBearing = turf.bearing(pt, aheadPt);
      prevBearing = lowPassBearing(prevBearing, targetBearing, 0.12);

      map.jumpTo({ center: [lng, lat], zoom: cruiseZoom, pitch: cruisePitch, bearing: prevBearing });

      // reveal the line just ahead of the camera
      const revealed = geo.totalLengthKm > 0 ? Math.min(1, (distKm + LOOKAHEAD_KM) / geo.totalLengthKm) : 0;
      timeline.routeProgress = revealed;
      setRouteProgress(map, revealed);
      reportClock();
      await wait(STEP_MS);
    }
    if (aborted()) break;

    // ── ARRIVAL: easeOutCubic descent into the stop ──
    const stop = stops[plan.toIdx];
    const loc = matchLocation(stop);
    const arriveZoom = loc?.zoom ?? 12.5;
    const arrivePitch = loc?.pitch ?? 60;
    const arriveBearing = loc?.bearing ?? prevBearing;
    await new Promise<void>((resolve) => {
      if (aborted()) return resolve();
      map.once('moveend', () => resolve());
      map.flyTo({
        center: [stop.lng, stop.lat],
        zoom: arriveZoom,
        pitch: arrivePitch,
        bearing: arriveBearing,
        duration: plan.arriveMs,
        easing: easeOutCubic,
        essential: true
      });
    });
    await waitForTiles(map);
    // full reveal up to this stop
    timeline.routeProgress = Math.min(1, geo.fractionAtStop[plan.toIdx]);
    setRouteProgress(map, timeline.routeProgress);
    prevBearing = map.getBearing();
    reportClock();
    if (aborted()) break;

    // ── DWELL: tiny parallax so the frame breathes under the stamp ──
    await dwell(map, arriveBearing, arrivePitch, plan.dwellMs, aborted, reportClock);
  }

  // ensure the line is fully drawn at the end
  if (!aborted()) {
    timeline.routeProgress = 1;
    setRouteProgress(map, 1);
  }
}

/** Small parallax oscillation around a base bearing/pitch for `ms`. */
async function dwell(
  map: MapLibreMap,
  baseBearing: number,
  basePitch: number,
  ms: number,
  aborted: () => boolean,
  report: () => void
): Promise<void> {
  const steps = Math.max(1, Math.round(ms / STEP_MS));
  for (let s = 0; s < steps; s++) {
    if (aborted()) return;
    const phase = s / 6;
    map.setBearing(baseBearing + Math.sin(phase) * 8);
    map.setPitch(basePitch + Math.sin(phase / 1.4) * 4);
    report();
    await wait(STEP_MS);
  }
}

/** Resolve when visible tiles are loaded, with a 5s safety timeout. */
function waitForTiles(map: MapLibreMap): Promise<void> {
  return new Promise((resolve) => {
    if (map.areTilesLoaded()) return resolve();
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
