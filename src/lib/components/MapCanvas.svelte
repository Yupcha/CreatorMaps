<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import {
    mapInstance, activeStyle, cameraState, viewSettings,
    filterString, mapStyles,
    type MapStyleKey
  } from '$lib/stores/mapStore';
  import { get } from 'svelte/store';

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map | undefined = $state(undefined);
  let buildings3DAdded = false;

  setContext('map', mapInstance);

  function getStyleUrl(key: MapStyleKey): string | object {
    const style = mapStyles.find((s) => s.key === key);
    if (!style) return mapStyles[0].url;
    // Inline JSON styles (satellite, terrain) are stored as JSON strings
    try {
      return JSON.parse(style.url);
    } catch {
      return style.url;
    }
  }

  function add3DBuildings() {
    if (!map || buildings3DAdded) return;
    const vs = get(viewSettings);
    if (!vs.buildings3D) return;

    // Only works with OpenFreeMap vector styles (not raster satellite/terrain)
    const currentStyle = get(activeStyle);
    if (currentStyle === 'satellite' || currentStyle === 'terrain') return;

    try {
      // Check if the source exists in vector styles
      const layers = map.getStyle()?.layers;
      if (!layers) return;

      map.addLayer({
        id: '3d-buildings',
        source: 'openmaptiles',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['get', 'render_height'],
            0, 'rgba(200, 200, 220, 0.8)',
            50, 'rgba(160, 170, 200, 0.8)',
            100, 'rgba(130, 140, 180, 0.8)',
            200, 'rgba(100, 110, 160, 0.8)',
          ],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 5],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.75,
        },
      });
      buildings3DAdded = true;
    } catch (e) {
      // Source may not exist for some styles
      console.warn('Could not add 3D buildings:', e);
    }
  }

  function setupTerrain() {
    if (!map) return;
    const vs = get(viewSettings);
    if (!vs.terrainEnabled) return;

    try {
      if (!map.getSource('terrain-dem')) {
        map.addSource('terrain-dem', {
          type: 'raster-dem',
          tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
          encoding: 'terrarium',
          tileSize: 512,
          maxzoom: 12,
        });
      }
      map.setTerrain({
        source: 'terrain-dem',
        exaggeration: vs.terrainExaggeration,
      });
    } catch (e) {
      console.warn('Could not set terrain:', e);
    }
  }

  function setupHillshade() {
    if (!map) return;
    const vs = get(viewSettings);
    if (!vs.skyAtmosphere) return;

    try {
      if (!map.getSource('hillshade-source')) {
        map.addSource('hillshade-source', {
          type: 'raster-dem',
          tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
          encoding: 'terrarium',
          tileSize: 512,
          maxzoom: 12,
        });
      }
      if (!map.getLayer('hillshade')) {
        map.addLayer({
          id: 'hillshade',
          type: 'hillshade',
          source: 'hillshade-source',
          paint: {
            'hillshade-shadow-color': '#473B24',
            'hillshade-illumination-anchor': 'map',
            'hillshade-exaggeration': 0.3,
          },
        }, map.getStyle()?.layers?.[0]?.id);
      }
    } catch {
      // hillshade setup may fail for some styles
    }
  }

  function syncCamera() {
    if (!map) return;
    const center = map.getCenter();
    cameraState.set({
      pitch: Math.round(map.getPitch()),
      bearing: Math.round(map.getBearing()),
      zoom: Math.round(map.getZoom() * 10) / 10,
      lng: Math.round(center.lng * 10000) / 10000,
      lat: Math.round(center.lat * 10000) / 10000,
    });
  }

  onMount(() => {
    const cs = get(cameraState);
    const style = get(activeStyle);
    const styleUrl = getStyleUrl(style);

    map = new maplibregl.Map({
      container: mapContainer,
      style: styleUrl as any,
      center: [cs.lng, cs.lat],
      zoom: cs.zoom,
      pitch: cs.pitch,
      bearing: cs.bearing,
      antialias: true,
      preserveDrawingBuffer: true,
      maxPitch: 85,
      fadeDuration: 0,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      // Start without terrain to avoid shader errors on initial load
      // Terrain can be enabled from the control panel
      setupHillshade();
      add3DBuildings();
      mapInstance.set(map!);
    });

    map.on('moveend', syncCamera);
    map.on('pitchend', syncCamera);
    map.on('zoomend', syncCamera);

    return () => {
      if (map) map.remove();
    };
  });

  // React to style changes
  $effect(() => {
    const style = $activeStyle;
    if (!map) return;
    buildings3DAdded = false;
    const styleUrl = getStyleUrl(style);
    map.setStyle(styleUrl as any);
    map.once('style.load', () => {
      setupTerrain();
      setupHillshade();
      add3DBuildings();
    });
  });

  // React to terrain exaggeration changes
  $effect(() => {
    const vs = $viewSettings;
    if (!map) return;
    try {
      if (vs.terrainEnabled && map.getSource('terrain-dem')) {
        map.setTerrain({
          source: 'terrain-dem',
          exaggeration: vs.terrainExaggeration,
        });
      } else if (!vs.terrainEnabled) {
        map.setTerrain(null as any);
      }
    } catch (_) { /* style may not be loaded yet */ }
  });

  // CSS filter — auto-boost brightness when dark style is active
  const cssFilter = $derived.by(() => {
    const base = $filterString;
    if ($activeStyle === 'dark') {
      return base === 'none'
        ? 'brightness(1.4)'
        : `${base} brightness(1.4)`;
    }
    return base;
  });
</script>

<div
  class="map-wrapper"
  style:filter={cssFilter}
>
  <div class="map-container" bind:this={mapContainer}></div>
</div>

<style>
  .map-wrapper {
    position: absolute;
    inset: 0;
    z-index: var(--z-map, 0);
    transition: filter 300ms ease;
  }

  .map-container {
    width: 100%;
    height: 100%;
  }

  .map-container :global(.maplibregl-canvas) {
    outline: none;
  }

  .map-container :global(.maplibregl-ctrl-attrib) {
    font-size: 10px !important;
    background: rgba(0,0,0,0.5) !important;
    color: rgba(255,255,255,0.5) !important;
    border-radius: 6px !important;
  }

  .map-container :global(.maplibregl-ctrl-attrib a) {
    color: rgba(255,255,255,0.6) !important;
  }
</style>
