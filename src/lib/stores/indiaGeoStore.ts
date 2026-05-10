import { writable, derived } from 'svelte/store';
import { INDIA_GEOJSON_URL, normalizeStateName, type OverlayMetric } from '$lib/data/indiaConstants';
import { indiaStates, type IndiaStateData } from '$lib/data/countryData';

// ─── GeoJSON Data ────────────────────────────────────────────
// Fetched once, cached in memory
let cachedGeoJSON: GeoJSON.FeatureCollection | null = null;

export const indiaGeoJSON = writable<GeoJSON.FeatureCollection | null>(null);
export const geoJSONLoading = writable(false);
export const geoJSONError = writable<string | null>(null);

export async function loadIndiaGeoJSON(): Promise<GeoJSON.FeatureCollection | null> {
  if (cachedGeoJSON) {
    indiaGeoJSON.set(cachedGeoJSON);
    return cachedGeoJSON;
  }

  geoJSONLoading.set(true);
  geoJSONError.set(null);

  try {
    const res = await fetch(INDIA_GEOJSON_URL);
    if (!res.ok) throw new Error(`Failed to fetch India GeoJSON: ${res.status}`);
    const data = await res.json() as GeoJSON.FeatureCollection;

    // Normalize state names in feature properties
    for (const feature of data.features) {
      const props = feature.properties || {};
      // The GeoJSON uses "stname" for state name at the district level
      const rawState = props.st_nm || props.stname || props.ST_NM || props.state || props.NAME_1 || '';
      props._normalizedState = normalizeStateName(rawState);
    }

    cachedGeoJSON = data;
    indiaGeoJSON.set(data);
    return data;
  } catch (e: any) {
    geoJSONError.set(e.message);
    return null;
  } finally {
    geoJSONLoading.set(false);
  }
}

// ─── Overlay State ───────────────────────────────────────────
export const stateOverlayVisible = writable(true);
export const indiaFocusMode = writable(false);
export const overlayMetric = writable<OverlayMetric>('population');
export const overlayOpacity = writable(0.65);
export const cityPinsVisible = writable(true);
export type BoundaryDetail = 'states' | 'districts' | 'all';
export const boundaryDetail = writable<BoundaryDetail>('states');
export const activeThematicFilter = writable<string | null>(null);

// ─── Hover / Selection ──────────────────────────────────────
export const hoveredStateName = writable<string | null>(null);
export const hoveredDistrictName = writable<string | null>(null);
export const hoveredMousePos = writable<{ x: number; y: number } | null>(null);
export const selectedStateName = writable<string | null>(null);

// ─── Derived: metrics lookup ─────────────────────────────────
const stateDataMap = new Map<string, IndiaStateData>();
for (const s of indiaStates) {
  stateDataMap.set(s.name, s);
}

export function getStateData(name: string): IndiaStateData | undefined {
  return stateDataMap.get(name);
}

// Get all unique state names from our data
export const allStateNames = indiaStates.map((s) => s.name);

// Derive sorted states by current metric for the legend/ranking
export const statesByMetric = derived(overlayMetric, ($metric) => {
  return [...indiaStates].sort((a, b) => {
    const va = a[$metric] as number;
    const vb = b[$metric] as number;
    return vb - va;
  });
});
