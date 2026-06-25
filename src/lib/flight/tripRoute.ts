/**
 * Trip-Reel route geometry, progressive-draw, and stamp timing.
 *
 * THE SIGNATURE VISUAL: a glowing route line that draws itself ahead of the
 * camera. We do this with a maplibre `line-gradient` driven by ONE per-frame
 * float on a dedicated `trip-route` source declared with `lineMetrics: true`.
 * Updating only the gradient stops (via setPaintProperty) costs nothing — the
 * geometry is tessellated ONCE. (Per-frame setData + lineSliceAlong re-builds
 * the buffer every frame and drops to single-digit fps at 4k — never do that.)
 *
 * Also computes per-leg distances/headings and emits a stamp timeline so the
 * compositor can land name/state/distance stamps in sync with each arrival.
 */

import * as turf from '@turf/turf';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { findCity } from '$lib/data/indianCities';
import { indianLocations } from '$lib/data/indianLocations';

export const TRIP_ROUTE_SOURCE = 'trip-route';
export const TRIP_ROUTE_GLOW = 'trip-route-glow';
export const TRIP_ROUTE_LINE = 'trip-route-line';

const COLOR_GLOW = '#10b981';
const COLOR_LINE = '#34d399';
/** Average road speed heuristic for the "~Yh by road" estimate. */
const ROAD_KMH = 50;

export interface TripStop {
  name: string;
  state: string;
  lng: number;
  lat: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
}

/** One stamp event on the timeline (resolved against the flight clock). */
export interface StampEvent {
  /** Index of the stop this stamp belongs to. */
  stopIndex: number;
  /** Main label, e.g. "Jaipur • Rajasthan". */
  label: string;
  /** Emotional subtitle (famousFor[0] / location description). */
  subtitle: string;
  /**
   * Distance string for the leg ARRIVING at this stop, e.g.
   * "~232 km · ~5h by road". Undefined for the first (origin) stop.
   */
  distance?: string;
  /** Raw leg distance in km (undefined for origin). */
  distanceKm?: number;
}

export interface TripRouteGeometry {
  /** The smoothed bezier of the whole journey (GeoJSON LineString feature). */
  curved: GeoJSON.Feature<GeoJSON.LineString>;
  /** Total route length in km. */
  totalLengthKm: number;
  /** Cumulative length (km) from origin to each stop, length === stops.length. */
  cumKmAtStop: number[];
  /** Fraction (0..1) of total length at each stop. */
  fractionAtStop: number[];
  /** Per-stop stamp metadata (distance/label/subtitle). */
  stamps: StampEvent[];
}

/** Round a km value to a friendly figure (nearest 5 below 100, else 10). */
function roundKm(km: number): number {
  if (km < 100) return Math.max(1, Math.round(km / 5) * 5);
  return Math.round(km / 10) * 10;
}

/** "~232 km · ~5h by road" — always prefixed "~", never claims exact road data. */
function formatLegDistance(km: number): string {
  const rk = roundKm(km);
  const hours = km / ROAD_KMH;
  let timeStr: string;
  if (hours < 1) {
    timeStr = `~${Math.max(15, Math.round((hours * 60) / 15) * 15)}m`;
  } else if (hours < 10) {
    timeStr = `~${hours.toFixed(hours < 3 ? 1 : 0)}h`;
  } else {
    timeStr = `~${Math.round(hours)}h`;
  }
  return `~${rk.toLocaleString('en-IN')} km · ${timeStr} by road`;
}

/** Resolve an emotional subtitle for a stop from the data layer. */
function subtitleFor(stop: TripStop): string {
  const city = findCity(stop.name);
  if (city?.famousFor?.length) return city.famousFor[0];
  const loc = indianLocations.find(
    (l) => l.name.toLowerCase() === stop.name.toLowerCase()
  );
  if (loc?.description) return loc.description;
  return stop.state || '';
}

/**
 * Build the route geometry + stamp metadata ONCE for a set of stops.
 * Uses a high bezier resolution so along()/gradient reads are smooth.
 */
export function buildRoute(stops: TripStop[]): TripRouteGeometry {
  const coords = stops.map((s) => [s.lng, s.lat]) as [number, number][];
  const line = turf.lineString(coords);
  // bezierSpline needs ≥2 points; for exactly 2 it still produces a gentle arc.
  const curved =
    coords.length >= 2
      ? (turf.bezierSpline(line, { resolution: 10000 }) as GeoJSON.Feature<GeoJSON.LineString>)
      : (line as GeoJSON.Feature<GeoJSON.LineString>);

  const totalLengthKm = turf.length(curved, { units: 'kilometers' });

  // Cumulative length at each ORIGINAL stop, found by nearest-point-on-line.
  const cumKmAtStop: number[] = [];
  for (let i = 0; i < stops.length; i++) {
    const snapped = turf.nearestPointOnLine(curved, turf.point(coords[i]), {
      units: 'kilometers'
    });
    cumKmAtStop.push(snapped.properties.location ?? 0);
  }
  // Guarantee monotonic non-decreasing + clamp endpoints.
  cumKmAtStop[0] = 0;
  cumKmAtStop[cumKmAtStop.length - 1] = totalLengthKm;
  for (let i = 1; i < cumKmAtStop.length; i++) {
    if (cumKmAtStop[i] < cumKmAtStop[i - 1]) cumKmAtStop[i] = cumKmAtStop[i - 1];
  }

  const fractionAtStop = cumKmAtStop.map((km) =>
    totalLengthKm > 0 ? Math.min(1, km / totalLengthKm) : 0
  );

  const stamps: StampEvent[] = stops.map((stop, i) => {
    const legKm = i === 0 ? undefined : cumKmAtStop[i] - cumKmAtStop[i - 1];
    return {
      stopIndex: i,
      label: stop.state ? `${stop.name} • ${stop.state}` : stop.name,
      subtitle: subtitleFor(stop),
      distance: legKm != null && legKm > 0 ? formatLegDistance(legKm) : undefined,
      distanceKm: legKm
    };
  });

  return { curved, totalLengthKm, cumKmAtStop, fractionAtStop, stamps };
}

/**
 * Build the maplibre `line-gradient` expression that reveals the line up to
 * `progress` (0..1) with a bright leading head fading to a dim tail.
 */
function gradientExpr(progress: number, baseColor: string): any {
  const p = Math.max(0.0001, Math.min(0.9999, progress));
  // Tail starts ~30% behind the head (the leading 30% is brightest).
  const tailStart = Math.max(0, p - 0.3);
  const stops: any[] = ['interpolate', ['linear'], ['line-progress']];
  // dim drawn tail
  stops.push(0, withAlpha(baseColor, 0.18));
  if (tailStart > 0) stops.push(tailStart, withAlpha(baseColor, 0.18));
  // brightening toward the head
  stops.push(Math.max(tailStart + 0.0001, p - 0.08), baseColor);
  stops.push(p, baseColor);
  // undrawn portion fully transparent
  stops.push(Math.min(1, p + 0.0001), 'rgba(0,0,0,0)');
  stops.push(1, 'rgba(0,0,0,0)');
  return stops;
}

/** Convert a #rrggbb hex to an rgba() string with the given alpha. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Add (or replace) the trip-route source + glow/line layers. Source MUST be
 * created with `lineMetrics: true` so `line-progress` is available to the
 * gradient. Starts fully hidden (progress 0).
 */
export function addRouteLayers(map: MapLibreMap, geo: TripRouteGeometry): void {
  removeRouteLayers(map);
  map.addSource(TRIP_ROUTE_SOURCE, {
    type: 'geojson',
    lineMetrics: true,
    data: geo.curved
  });
  map.addLayer({
    id: TRIP_ROUTE_GLOW,
    type: 'line',
    source: TRIP_ROUTE_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': 10,
      'line-blur': 8,
      'line-gradient': gradientExpr(0, COLOR_GLOW)
    }
  });
  map.addLayer({
    id: TRIP_ROUTE_LINE,
    type: 'line',
    source: TRIP_ROUTE_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': 3,
      'line-gradient': gradientExpr(0, COLOR_LINE)
    }
  });
}

/**
 * Reveal the route up to `p` (0..1). Touches ONLY the two gradients — zero
 * re-tessellation, holds 60fps even at 4k. Safe to call every frame.
 */
export function setRouteProgress(map: MapLibreMap, p: number): void {
  if (!map.getLayer(TRIP_ROUTE_GLOW)) return;
  try {
    map.setPaintProperty(TRIP_ROUTE_GLOW, 'line-gradient', gradientExpr(p, COLOR_GLOW));
    map.setPaintProperty(TRIP_ROUTE_LINE, 'line-gradient', gradientExpr(p, COLOR_LINE));
  } catch {
    /* layer torn down mid-frame — ignore */
  }
}

/** Remove the trip-route source + layers (idempotent). */
export function removeRouteLayers(map: MapLibreMap): void {
  for (const id of [TRIP_ROUTE_GLOW, TRIP_ROUTE_LINE]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(TRIP_ROUTE_SOURCE)) map.removeSource(TRIP_ROUTE_SOURCE);
}
