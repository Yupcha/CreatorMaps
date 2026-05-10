import { writable, derived } from 'svelte/store';
import type { Map as MapLibreMap } from 'maplibre-gl';

// Map instance
export const mapInstance = writable<MapLibreMap | null>(null);

// Map style options
export type MapStyleKey = 'liberty' | 'bright' | 'positron' | 'dark' | 'satellite' | 'terrain';

export interface MapStyleOption {
  key: MapStyleKey;
  label: string;
  url: string;
  icon: string;
}

// OpenFreeMap styles (no API key needed) + free satellite/terrain
export const mapStyles: MapStyleOption[] = [
  { key: 'liberty', label: 'Liberty', url: 'https://tiles.openfreemap.org/styles/liberty', icon: '🗺️' },
  { key: 'bright', label: 'Bright', url: 'https://tiles.openfreemap.org/styles/bright', icon: '☀️' },
  { key: 'positron', label: 'Positron', url: 'https://tiles.openfreemap.org/styles/positron', icon: '⚪' },
  { key: 'dark', label: 'Dark', url: 'https://tiles.openfreemap.org/styles/dark', icon: '🌙' },
  {
    key: 'satellite', label: 'Satellite', icon: '🛰️',
    url: JSON.stringify({
      version: 8,
      name: 'Satellite',
      sources: {
        'satellite-tiles': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '© Esri, Maxar, Earthstar Geographics',
          maxzoom: 19,
        }
      },
      layers: [
        { id: 'satellite-layer', type: 'raster', source: 'satellite-tiles' }
      ]
    })
  },
  {
    key: 'terrain', label: 'Terrain', icon: '⛰️',
    url: JSON.stringify({
      version: 8,
      name: 'Terrain',
      sources: {
        'terrain-raster': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '© Esri, HERE, Garmin, OpenStreetMap',
          maxzoom: 19,
        }
      },
      layers: [
        { id: 'terrain-raster-layer', type: 'raster', source: 'terrain-raster' }
      ]
    })
  },
];

// Active style
export const activeStyle = writable<MapStyleKey>('liberty');

// Camera state
export const cameraState = writable({
  pitch: 45,
  bearing: 0,
  zoom: 5,
  lng: 78.9629,
  lat: 20.5937,
});

// View settings
export const viewSettings = writable({
  terrainEnabled: false,
  terrainExaggeration: 1.5,
  buildings3D: true,
  fog: true,
  fogDensity: 0.3,
  skyAtmosphere: true,
});

// Visual filters (CSS)
export const visualFilters = writable({
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  hueRotate: 0,
  sepia: 0,
  grayscale: 0,
});

// Derived CSS filter string
export const filterString = derived(visualFilters, ($f) => {
  const parts: string[] = [];
  if ($f.brightness !== 1.0) parts.push(`brightness(${$f.brightness})`);
  if ($f.contrast !== 1.0) parts.push(`contrast(${$f.contrast})`);
  if ($f.saturation !== 1.0) parts.push(`saturate(${$f.saturation})`);
  if ($f.hueRotate !== 0) parts.push(`hue-rotate(${$f.hueRotate}deg)`);
  if ($f.sepia !== 0) parts.push(`sepia(${$f.sepia}%)`);
  if ($f.grayscale !== 0) parts.push(`grayscale(${$f.grayscale}%)`);
  return parts.length ? parts.join(' ') : 'none';
});

// Panel state
export const panelOpen = writable(true);
export const activeTab = writable<'view' | 'filters' | 'export' | 'presets'>('view');

// Export settings
export const exportSettings = writable({
  format: 'png' as 'png' | 'jpeg',
  quality: 0.92,
  pixelRatio: 2,
});

// Presets
export interface MapPreset {
  name: string;
  icon: string;
  description: string;
  style: MapStyleKey;
  pitch: number;
  bearing: number;
  zoom: number;
  lng: number;
  lat: number;
  exaggeration: number;
  filters: {
    brightness: number;
    contrast: number;
    saturation: number;
    hueRotate: number;
    sepia: number;
    grayscale: number;
  };
}

export const presets: MapPreset[] = [
  {
    name: 'Himalayan Drama',
    icon: '🏔️',
    description: 'High pitch satellite with warm tones',
    style: 'satellite',
    pitch: 60, bearing: -25, zoom: 9, lng: 78.0, lat: 30.5,
    exaggeration: 2.5,
    filters: { brightness: 1.1, contrast: 1.2, saturation: 1.3, hueRotate: 0, sepia: 10, grayscale: 0 },
  },
  {
    name: 'Clean Outline',
    icon: '📐',
    description: 'Top-down positron style, clean borders',
    style: 'positron',
    pitch: 0, bearing: 0, zoom: 4.5, lng: 78.9629, lat: 22.0,
    exaggeration: 0,
    filters: { brightness: 1.0, contrast: 1.1, saturation: 0.8, hueRotate: 0, sepia: 0, grayscale: 0 },
  },
  {
    name: 'Night Mode',
    icon: '🌃',
    description: 'Dark style with high contrast',
    style: 'dark',
    pitch: 55, bearing: 15, zoom: 6, lng: 78.9629, lat: 22.0,
    exaggeration: 1.0,
    filters: { brightness: 1.2, contrast: 1.4, saturation: 1.5, hueRotate: 0, sepia: 0, grayscale: 0 },
  },
  {
    name: 'Topo Explorer',
    icon: '🌏',
    description: 'Terrain style with elevation details',
    style: 'terrain',
    pitch: 45, bearing: 0, zoom: 7, lng: 78.9629, lat: 20.5937,
    exaggeration: 1.5,
    filters: { brightness: 1.0, contrast: 1.0, saturation: 1.1, hueRotate: 0, sepia: 0, grayscale: 0 },
  },
  {
    name: 'Desert Gold',
    icon: '🏜️',
    description: 'Warm-toned satellite of the Thar',
    style: 'satellite',
    pitch: 45, bearing: 30, zoom: 9, lng: 71.0, lat: 27.0,
    exaggeration: 2.0,
    filters: { brightness: 1.15, contrast: 1.1, saturation: 1.4, hueRotate: 15, sepia: 20, grayscale: 0 },
  },
  {
    name: 'Monochrome',
    icon: '⬛',
    description: 'Dramatic black & white aerial',
    style: 'satellite',
    pitch: 50, bearing: 0, zoom: 8, lng: 76.5, lat: 14.0,
    exaggeration: 1.8,
    filters: { brightness: 1.1, contrast: 1.5, saturation: 0, hueRotate: 0, sepia: 0, grayscale: 100 },
  },
];
