<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { MapboxOverlay } from '@deck.gl/mapbox';
  import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
  import {
    mapInstance, activeStyle, cameraState, viewSettings,
    filterString, mapStyles,
    type MapStyleKey
  } from '$lib/stores/mapStore';
  import {
    loadIndiaGeoJSON, stateOverlayVisible, indiaFocusMode,
    overlayMetric, overlayOpacity, hoveredStateName,
    hoveredMousePos, selectedStateName, getStateData,
    cityPinsVisible, boundaryDetail, hoveredDistrictName,
    activeThematicFilter,
  } from '$lib/stores/indiaGeoStore';
  import { indiaStates } from '$lib/data/countryData';
  import { indianCities, type IndianCity } from '$lib/data/indianCities';
  import {
    INDIA_BOUNDS, normalizeStateName, getMetricColor,
    METRIC_CONFIGS, type OverlayMetric,
  } from '$lib/data/indiaConstants';
  import { get } from 'svelte/store';

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map | undefined = $state(undefined);
  let buildings3DAdded = false;
  let indiaLayersAdded = false;
  let deckOverlay: MapboxOverlay | undefined;

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

  // ─── India State Boundary Layers ───────────────────────────
  async function addIndiaLayers() {
    if (!map || indiaLayersAdded) return;

    const geoData = await loadIndiaGeoJSON();
    if (!geoData || !map) return;

    try {
      // Add GeoJSON source
      if (!map.getSource('india-states')) {
        map.addSource('india-states', {
          type: 'geojson',
          data: geoData,
          generateId: true,
        });
      }

      const metric = get(overlayMetric);

      // Helper to safely add a layer only if it doesn't already exist
      const safeAddLayer = (layerDef: any) => {
        if (!map!.getLayer(layerDef.id)) {
          map!.addLayer(layerDef);
        }
      };

      // State fill layer — choropleth colored
      safeAddLayer({
        id: 'india-states-fill',
        type: 'fill',
        source: 'india-states',
        paint: {
          'fill-color': buildChoroplethExpression(metric),
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.85,
            ['*', get(overlayOpacity), ['coalesce', ['feature-state', 'reveal'], 1]],
          ],
        },
      });

      // State boundary glow layer (cinematic soft edge)
      safeAddLayer({
        id: 'india-states-glow',
        type: 'line',
        source: 'india-states',
        paint: {
          'line-color': '#4f46e5',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            3, 3,
            6, 6,
            10, 10,
          ],
          'line-opacity': 0.15,
          'line-blur': [
            'interpolate', ['linear'], ['zoom'],
            3, 2,
            6, 5,
            10, 8,
          ]
        },
      });

      // Main State border lines — thin, crisp, glowing
      safeAddLayer({
        id: 'india-states-outline',
        type: 'line',
        source: 'india-states',
        paint: {
          'line-color': 'rgba(165, 180, 252, 0.65)',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            3, 0.5,
            6, 1,
            10, 1.5,
            14, 2,
          ],
        },
      });

      // District border lines — extremely subtle
      safeAddLayer({
        id: 'india-districts-outline',
        type: 'line',
        source: 'india-states',
        paint: {
          'line-color': 'rgba(129, 140, 248, 0.15)',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            5, 0,
            6, 0.2,
            8, 0.4,
            10, 0.6,
            14, 1,
          ],
          'line-dasharray': [3, 3],
        },
        layout: {
          'visibility': get(boundaryDetail) !== 'states' ? 'visible' : 'none',
        },
      });

      // Highlighted border for hovered state
      safeAddLayer({
        id: 'india-states-highlight',
        type: 'line',
        source: 'india-states',
        paint: {
          'line-color': '#818cf8',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            3, 1,
            5, 2,
            8, 3,
          ],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1,
            0,
          ],
        },
      });

      // Selected state glow border
      safeAddLayer({
        id: 'india-states-selected',
        type: 'line',
        source: 'india-states',
        paint: {
          'line-color': '#22d3ee',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            3, 2,
            5, 3,
            8, 4,
          ],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            1,
            0,
          ],
        },
      });

      // State name labels at center of each feature
      safeAddLayer({
        id: 'india-states-labels',
        type: 'symbol',
        source: 'india-states',
        layout: {
          'text-field': ['coalesce', ['get', 'district'], ['get', 'st_nm'], ''],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            4, 7,
            6, 10,
            8, 13,
          ],
          'text-font': ['Noto Sans Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-max-width': 8,
        },
        paint: {
          'text-color': 'rgba(255, 255, 255, 0.9)',
          'text-halo-color': 'rgba(0, 0, 0, 0.7)',
          'text-halo-width': 1.5,
        },
        minzoom: 5,
      });

      // Wire up hover interactions
      let hoveredFeatureId: number | string | null = null;

      map.on('mousemove', 'india-states-fill', (e) => {
        if (!e.features?.length || !map) return;
        map.getCanvas().style.cursor = 'pointer';

        const feature = e.features[0];
        const props = feature.properties || {};
        const stateName = props._normalizedState ||
          normalizeStateName(props.st_nm || props.stname || props.ST_NM || props.state || '');
        const districtName = props.district || props.dtname || props.dt_name || null;

        // Update hover feature state
        if (hoveredFeatureId !== null && hoveredFeatureId !== undefined) {
          map.setFeatureState(
            { source: 'india-states', id: hoveredFeatureId },
            { hover: false },
          );
        }
        hoveredFeatureId = feature.id ?? null;
        if (hoveredFeatureId !== null && hoveredFeatureId !== undefined) {
          map.setFeatureState(
            { source: 'india-states', id: hoveredFeatureId },
            { hover: true },
          );
        }

        hoveredStateName.set(stateName);
        hoveredDistrictName.set(districtName);
        hoveredMousePos.set({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
      });

      map.on('mouseleave', 'india-states-fill', () => {
        if (!map) return;
        map.getCanvas().style.cursor = '';
        if (hoveredFeatureId !== null && hoveredFeatureId !== undefined) {
          map.setFeatureState(
            { source: 'india-states', id: hoveredFeatureId },
            { hover: false },
          );
        }
        hoveredFeatureId = null;
        hoveredStateName.set(null);
        hoveredDistrictName.set(null);
        hoveredMousePos.set(null);
      });

      // Click — select state and fly to it
      let selectedFeatureId: number | string | null = null;

      map.on('click', 'india-states-fill', (e) => {
        if (!e.features?.length || !map) return;
        const feature = e.features[0];
        const props = feature.properties || {};
        const stateName = props._normalizedState ||
          normalizeStateName(props.st_nm || props.stname || props.ST_NM || props.state || '');

        // Clear previous selection
        if (selectedFeatureId !== null && selectedFeatureId !== undefined) {
          map.setFeatureState(
            { source: 'india-states', id: selectedFeatureId },
            { selected: false },
          );
        }

        selectedFeatureId = feature.id ?? null;
        if (selectedFeatureId !== null && selectedFeatureId !== undefined) {
          map.setFeatureState(
            { source: 'india-states', id: selectedFeatureId },
            { selected: true },
          );
        }

        selectedStateName.set(stateName);

        // Fly to the feature's approximate center
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
          const bounds = new maplibregl.LngLatBounds();
          const addCoords = (coords: number[][]) =>
            coords.forEach(c => bounds.extend(c as [number, number]));

          if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates.forEach(addCoords);
          } else {
            feature.geometry.coordinates.forEach(poly => poly.forEach(addCoords));
          }

          map.flyTo({
            center: bounds.getCenter(),
            zoom: 7,
            pitch: 45,
            duration: 2000,
          });
        }
      });

      indiaLayersAdded = true;
    } catch (e) {
      console.warn('Could not add India layers:', e);
    }
  }

  /**
   * Build a MapLibre expression for choropleth fill coloring based on the
   * selected metric. This creates a match expression mapping state names
   * to their metric-derived colors.
   */
  function buildChoroplethExpression(metric: OverlayMetric): any {
    // Build a case expression mapping normalized state names to their metric-derived colors
    const cases: any[] = ['case'];

    for (const state of indiaStates) {
      const color = getMetricColor(metric, state[metric] as number);
      const rgba = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
      cases.push(['==', ['get', '_normalizedState'], state.name]);
      cases.push(rgba);
    }

    // Default fallback color
    cases.push('rgba(30, 30, 50, 0.5)');
    return cases;
  }

  // ─── deck.gl Overlay ──────────────────────────────────────
  function getCityColor(cat: string): [number, number, number, number] {
    switch (cat) {
      case 'metro': return [99, 102, 241, 200];     // indigo
      case 'tier1': return [6, 182, 212, 200];       // cyan
      case 'tier2': return [245, 158, 11, 180];      // amber
      case 'tier3': return [16, 185, 129, 180];      // emerald
      case 'ut_capital': return [168, 85, 247, 200]; // purple
      case 'landmark': return [239, 68, 68, 200];    // red
      default: return [156, 163, 175, 160];
    }
  }

  function getCityRadius(pop: number): number {
    if (pop > 10000000) return 12000;
    if (pop > 5000000) return 9000;
    if (pop > 1000000) return 6000;
    if (pop > 500000) return 4500;
    if (pop > 100000) return 3500;
    return 2500;
  }

  function buildDeckLayers(showPins: boolean) {
    if (!showPins) return [];

    let filteredCities = indianCities;
    const filter = get(activeThematicFilter);
    if (filter) {
      filteredCities = indianCities.filter(c => c.tags.includes(filter) || c.industries.map(i => i.toLowerCase()).includes(filter) || (filter === 'film' && c.filmIndustry));
    }

    return [
      new ScatterplotLayer({
        id: 'city-pins',
        data: filteredCities,
        getPosition: (d: IndianCity) => [d.lng, d.lat],
        getRadius: (d: IndianCity) => getCityRadius(d.population),
        getFillColor: (d: IndianCity) => getCityColor(d.category),
        getLineColor: [255, 255, 255, 120],
        getLineWidth: 1,
        stroked: true,
        filled: true,
        radiusMinPixels: 3,
        radiusMaxPixels: 22,
        lineWidthMinPixels: 1,
        pickable: true,
        antialiasing: true,
      }),
      new TextLayer({
        id: 'city-labels',
        data: filteredCities.filter(c => c.category === 'metro' || c.category === 'tier1' || c.population > 1000000 || filter),
        getPosition: (d: IndianCity) => [d.lng, d.lat],
        getText: (d: IndianCity) => d.name,
        getSize: 12,
        getColor: [241, 241, 244, 210],
        getAngle: 0,
        getTextAnchor: 'start' as const,
        getAlignmentBaseline: 'center' as const,
        getPixelOffset: [12, 0],
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        outlineWidth: 3,
        outlineColor: [0, 0, 0, 200],
        sizeMinPixels: 9,
        sizeMaxPixels: 14,
        pickable: false,
      }),
    ];
  }

  function initDeckOverlay() {
    if (!map) return;
    try {
      const showPins = get(cityPinsVisible);
      deckOverlay = new MapboxOverlay({
        layers: buildDeckLayers(showPins),
      });
      map.addControl(deckOverlay as any);
      console.log('✅ deck.gl overlay initialized with', showPins ? 'city pins' : 'no layers');
    } catch (e) {
      console.warn('Could not initialize deck.gl overlay:', e);
    }
  }

  // ─── Camera Sync ──────────────────────────────────────────
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
      preserveDrawingBuffer: true,
      maxPitch: 85,
      fadeDuration: 0,
      attributionControl: false,
    } as any);

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-right');

    map.on('load', () => {
      // Start without terrain to avoid shader errors on initial load
      // Terrain can be enabled from the control panel
      setupHillshade();
      add3DBuildings();
      mapInstance.set(map!);

      // Initialize deck.gl overlay
      initDeckOverlay();

      // Add India GeoJSON layers if overlay is visible
      if (get(stateOverlayVisible)) {
        addIndiaLayers();
      }

      // Inject MapLibre scale control safely alongside InfoBar
      setTimeout(() => {
        const mlContainer = document.getElementById('maplibre-controls-container');
        const scale = document.querySelector('.maplibregl-ctrl-scale');
        if (mlContainer && scale) {
          mlContainer.appendChild(scale);
        }
      }, 500);

      // Custom trackpad panning: intercept wheel events in capture phase to prevent MapLibre from zooming
      // (Pinch-to-zoom natively sets ctrlKey=true on trackpad wheel events)
      mapContainer.addEventListener('wheel', (e: WheelEvent) => {
        // Trackpad vs Mouse wheel heuristic:
        // Trackpads typically use DOM_DELTA_PIXEL (0) and often have deltaX, or fractional/small deltaY
        const isTrackpad = e.deltaMode === 0 && (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) < 50 || e.deltaY % 1 !== 0);
        
        if (!e.ctrlKey && isTrackpad) {
          e.preventDefault();
          e.stopPropagation(); // Stop MapLibre from seeing this and zooming
          map!.panBy([e.deltaX, e.deltaY], { animate: false });
        }
      }, { passive: false, capture: true });
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
    indiaLayersAdded = false;
    const styleUrl = getStyleUrl(style);
    map.setStyle(styleUrl as any);
    map.once('style.load', () => {
      setupTerrain();
      setupHillshade();
      add3DBuildings();
      if (get(stateOverlayVisible)) {
        addIndiaLayers();
      }
    });
  });

  // React to overlay visibility toggle
  $effect(() => {
    const visible = $stateOverlayVisible;
    if (!map) return;
    const layers = ['india-states-fill', 'india-states-outline', 'india-states-glow', 'india-districts-outline', 'india-states-highlight', 'india-states-selected', 'india-states-labels'];
    for (const id of layers) {
      if (map.getLayer(id)) {
        // District layer has its own visibility logic, so we respect it if main overlay is visible
        if (id === 'india-districts-outline' && visible) {
           map.setLayoutProperty(id, 'visibility', get(boundaryDetail) !== 'states' ? 'visible' : 'none');
        } else {
           map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }
      }
    }
    // If turning on and layers not yet added, add them
    if (visible && !indiaLayersAdded) {
      addIndiaLayers();
    }
  });

  // React to boundary detail toggle
  $effect(() => {
    const detail = $boundaryDetail;
    const visible = $stateOverlayVisible;
    if (!map || !indiaLayersAdded || !visible) return;
    
    if (map.getLayer('india-districts-outline')) {
      map.setLayoutProperty('india-districts-outline', 'visibility', detail !== 'states' ? 'visible' : 'none');
    }
  });

  // React to metric changes — update fill colors
  $effect(() => {
    const metric = $overlayMetric;
    if (!map || !indiaLayersAdded) return;
    if (map.getLayer('india-states-fill')) {
      map.setPaintProperty('india-states-fill', 'fill-color', buildChoroplethExpression(metric));
    }
  });

  // React to opacity changes
  $effect(() => {
    const opacity = $overlayOpacity;
    if (!map || !indiaLayersAdded) return;
    if (map.getLayer('india-states-fill')) {
      map.setPaintProperty('india-states-fill', 'fill-opacity', [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        Math.min(1, opacity + 0.2),
        ['*', opacity, ['coalesce', ['feature-state', 'reveal'], 1]],
      ]);
    }
  });

  // React to India focus mode
  $effect(() => {
    const focus = $indiaFocusMode;
    if (!map) return;
    if (focus) {
      map.setMaxBounds(INDIA_BOUNDS);
      map.fitBounds(INDIA_BOUNDS, { padding: 40, duration: 1500 });
    } else {
      map.setMaxBounds(undefined as any);
    }
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

  // React to city pins toggle or filter changes
  $effect(() => {
    const showPins = $cityPinsVisible;
    const filter = $activeThematicFilter;
    if (!deckOverlay) return;
    try {
      deckOverlay.setProps({ layers: buildDeckLayers(showPins) });
    } catch (_) { /* overlay may not be ready */ }
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
