// India geographic constants and color palettes for state visualization

// India bounding box [sw, ne] — includes all territories
export const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [68.1, 6.5],   // Southwest (Gujarat coast to Kanyakumari)
  [97.5, 37.1],  // Northeast (Arunachal Pradesh to Siachen)
];

// India geographic center (for overview positioning)
export const INDIA_CENTER: [number, number] = [78.9629, 22.0];

// Default overview zoom
export const INDIA_OVERVIEW_ZOOM = 4.5;

// GeoJSON CDN URL — all-India with state/UT boundaries
export const INDIA_GEOJSON_URL =
  'https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@ef25ebc/geojson/india.geojson';

// Metric types for choropleth coloring
export type OverlayMetric = 'population' | 'gdpBillionUsd' | 'literacy' | 'area';

export interface MetricConfig {
  key: OverlayMetric;
  label: string;
  icon: string;
  unit: string;
  format: (v: number) => string;
  // Color stops: [min color, mid color, max color] in RGBA
  colors: [string, string, string];
  // Corresponding RGBA arrays for deck.gl
  colorStops: [number[], number[], number[]];
  min: number;
  max: number;
}

function formatPop(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)} L`;
  return n.toLocaleString('en-IN');
}

export const METRIC_CONFIGS: Record<OverlayMetric, MetricConfig> = {
  population: {
    key: 'population',
    label: 'Population',
    icon: '👥',
    unit: '',
    format: formatPop,
    colors: ['#1a1a2e', '#e94560', '#ff6b6b'],
    colorStops: [[26, 26, 46, 180], [233, 69, 96, 200], [255, 107, 107, 220]],
    min: 50000,
    max: 200000000,
  },
  gdpBillionUsd: {
    key: 'gdpBillionUsd',
    label: 'GDP',
    icon: '💰',
    unit: 'B USD',
    format: (v) => `$${v}B`,
    colors: ['#0a1628', '#f59e0b', '#fbbf24'],
    colorStops: [[10, 22, 40, 180], [245, 158, 11, 200], [251, 191, 36, 220]],
    min: 0.1,
    max: 440,
  },
  literacy: {
    key: 'literacy',
    label: 'Literacy',
    icon: '📚',
    unit: '%',
    format: (v) => `${v.toFixed(1)}%`,
    colors: ['#0a1628', '#10b981', '#34d399'],
    colorStops: [[10, 22, 40, 180], [16, 185, 129, 200], [52, 211, 153, 220]],
    min: 60,
    max: 95,
  },
  area: {
    key: 'area',
    label: 'Area',
    icon: '📐',
    unit: 'km²',
    format: (v) => `${v.toLocaleString('en-IN')} km²`,
    colors: ['#0a1628', '#6366f1', '#818cf8'],
    colorStops: [[10, 22, 40, 180], [99, 102, 241, 200], [129, 140, 248, 220]],
    min: 30,
    max: 342000,
  },
};

// State name normalization — maps GeoJSON feature "dtname"/"stname" variants
// to our indiaStates data keys. The GeoJSON uses district-level features with
// a state attribute. We normalize to match our curated state data.
export const STATE_NAME_MAP: Record<string, string> = {
  // Exact GeoJSON title-case values that differ from our data keys
  'Jammu and Kashmir': 'Jammu & Kashmir',
  'Delhi': 'Delhi NCT',
  'Andaman and Nicobar Islands': 'Andaman & Nicobar',
  'Dadra and Nagar Haveli and Daman and Diu': 'Dadra & Nagar Haveli',

  // UPPERCASE variants (for safety)
  'MAHARASHTRA': 'Maharashtra',
  'UTTAR PRADESH': 'Uttar Pradesh',
  'TAMIL NADU': 'Tamil Nadu',
  'KARNATAKA': 'Karnataka',
  'GUJARAT': 'Gujarat',
  'RAJASTHAN': 'Rajasthan',
  'WEST BENGAL': 'West Bengal',
  'MADHYA PRADESH': 'Madhya Pradesh',
  'KERALA': 'Kerala',
  'TELANGANA': 'Telangana',
  'ANDHRA PRADESH': 'Andhra Pradesh',
  'PUNJAB': 'Punjab',
  'ODISHA': 'Odisha',
  'BIHAR': 'Bihar',
  'ASSAM': 'Assam',
  'GOA': 'Goa',
  'HIMACHAL PRADESH': 'Himachal Pradesh',
  'UTTARAKHAND': 'Uttarakhand',
  'JHARKHAND': 'Jharkhand',
  'CHHATTISGARH': 'Chhattisgarh',
  'HARYANA': 'Haryana',
  'JAMMU AND KASHMIR': 'Jammu & Kashmir',
  'JAMMU & KASHMIR': 'Jammu & Kashmir',
  'NCT OF DELHI': 'Delhi NCT',
  'DELHI': 'Delhi NCT',
  'SIKKIM': 'Sikkim',
  'MEGHALAYA': 'Meghalaya',
  'MANIPUR': 'Manipur',
  'MIZORAM': 'Mizoram',
  'NAGALAND': 'Nagaland',
  'TRIPURA': 'Tripura',
  'ARUNACHAL PRADESH': 'Arunachal Pradesh',
  'LADAKH': 'Ladakh',
  'ANDAMAN AND NICOBAR': 'Andaman & Nicobar',
  'ANDAMAN AND NICOBAR ISLANDS': 'Andaman & Nicobar',
  'CHANDIGARH': 'Chandigarh',
  'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': 'Dadra & Nagar Haveli',
  'DADRA & NAGAR HAVELI AND DAMAN & DIU': 'Dadra & Nagar Haveli',
  'DNH AND DD': 'Dadra & Nagar Haveli',
  'LAKSHADWEEP': 'Lakshadweep',
  'PUDUCHERRY': 'Puducherry',
  'ORISSA': 'Odisha',
};

/**
 * Normalize a state name from GeoJSON feature properties to match
 * our curated indiaStates data keys.
 */
export function normalizeStateName(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Check exact match first (GeoJSON uses title case like "Jammu and Kashmir")
  if (STATE_NAME_MAP[trimmed]) return STATE_NAME_MAP[trimmed];
  // Then try uppercase
  const upper = trimmed.toUpperCase();
  if (STATE_NAME_MAP[upper]) return STATE_NAME_MAP[upper];

  // Title case fallback — if it already matches our data, return as-is
  return trimmed.replace(/\w\S*/g, (t) =>
    t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
  );
}

/**
 * Interpolate a color between two RGBA arrays based on a 0–1 ratio.
 */
export function lerpColor(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

/**
 * Get choropleth color for a metric value.
 */
export function getMetricColor(metric: OverlayMetric, value: number): number[] {
  const config = METRIC_CONFIGS[metric];
  const ratio = Math.max(0, Math.min(1, (value - config.min) / (config.max - config.min)));
  if (ratio < 0.5) {
    return lerpColor(config.colorStops[0], config.colorStops[1], ratio * 2);
  }
  return lerpColor(config.colorStops[1], config.colorStops[2], (ratio - 0.5) * 2);
}
