<script lang="ts">
  import { Search, MapPin, Loader2, X, Plus, Video, Trash2, Eye, Plane, Orbit, ArrowUpFromDot, Route, ZoomIn, MoveHorizontal } from '@lucide/svelte';
  import { mapInstance, recordingMode } from '$lib/stores/mapStore';
  import { get } from 'svelte/store';
  import * as turf from '@turf/turf';

  type FlightStyle = 'flythrough' | 'orbit' | 'dronerise' | 'tracking' | 'timelapse' | 'parallax';
  type DurationKey = 'quick' | 'normal' | 'cinematic' | 'epic';
  type ResolutionKey = '720p' | '1080p' | '4k';

  const flightStyles: { key: FlightStyle; label: string; icon: typeof Plane; desc: string }[] = [
    { key: 'flythrough', label: 'Fly Through', icon: Plane, desc: 'Smooth glide between points' },
    { key: 'orbit', label: 'Orbit', icon: Orbit, desc: '360° spin at each stop' },
    { key: 'dronerise', label: 'Drone Rise', icon: ArrowUpFromDot, desc: 'Ground to sky reveal' },
    { key: 'tracking', label: 'Tracking', icon: Route, desc: 'Follow route at low altitude' },
    { key: 'timelapse', label: 'Timelapse', icon: ZoomIn, desc: 'Zoom from space to ground' },
    { key: 'parallax', label: 'Parallax', icon: MoveHorizontal, desc: 'Lateral drift with depth' },
  ];

  const durations: { key: DurationKey; label: string; ms: number }[] = [
    { key: 'quick', label: '8s', ms: 8000 },
    { key: 'normal', label: '15s', ms: 15000 },
    { key: 'cinematic', label: '30s', ms: 30000 },
    { key: 'epic', label: '60s', ms: 60000 },
  ];

  const resolutions: { key: ResolutionKey; w: number; h: number }[] = [
    { key: '720p', w: 1280, h: 720 },
    { key: '1080p', w: 1920, h: 1080 },
    { key: '4k', w: 3840, h: 2160 },
  ];

  const routeTemplates = [
    { name: 'Business Corridor', desc: 'Mumbai → Delhi', points: [{ q: 'Mumbai', lat: 19.076, lon: 72.8777 }, { q: 'Delhi', lat: 28.6139, lon: 77.209 }] },
    { name: 'North-South Sweep', desc: 'Kashmir → Kanyakumari', points: [{ q: 'Srinagar', lat: 34.0837, lon: 74.7973 }, { q: 'Kanyakumari', lat: 8.0883, lon: 77.5385 }] },
    { name: 'Golden Triangle', desc: 'Delhi → Agra → Jaipur', points: [{ q: 'Delhi', lat: 28.6139, lon: 77.209 }, { q: 'Agra', lat: 27.1767, lon: 78.0081 }, { q: 'Jaipur', lat: 26.9124, lon: 75.7873 }] },
    { name: 'Coastal Run', desc: 'Mumbai → Goa → Kochi', points: [{ q: 'Mumbai', lat: 19.076, lon: 72.8777 }, { q: 'Goa', lat: 15.2993, lon: 74.124 }, { q: 'Kochi', lat: 9.9312, lon: 76.2673 }] },
    { name: 'Himalayan Trail', desc: 'Shimla → Manali → Leh', points: [{ q: 'Shimla', lat: 31.1048, lon: 77.1734 }, { q: 'Manali', lat: 32.2396, lon: 77.1887 }, { q: 'Leh', lat: 34.1526, lon: 77.577 }] },
  ];

  interface Waypoint {
    id: string;
    query: string;
    lat: number | null;
    lon: number | null;
    loading: boolean;
    results: any[];
    isOpen: boolean;
  }

  let waypoints = $state<Waypoint[]>([
    { id: 'start', query: '', lat: null, lon: null, loading: false, results: [], isOpen: false },
    { id: 'end', query: '', lat: null, lon: null, loading: false, results: [], isOpen: false }
  ]);

  let isRecording = $state(false);
  let isRendering = $state(false);
  let isExpanded = $state(false);
  let isPreviewing = $state(false);
  let activeFlightStyle = $state<FlightStyle>('flythrough');
  let activeDuration = $state<DurationKey>('normal');
  let activeResolution = $state<ResolutionKey>('1080p');
  let searchTimeouts: Record<string, any> = {};
  let searchHistory = $state<{ query: string; lat: number; lon: number }[]>([]);
  
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];

  // --- LocalStorage persistence ---
  const STORAGE_KEY = 'yupcha-cinematic-session';
  const HISTORY_KEY = 'yupcha-search-history';

  function saveSession() {
    try {
      const session = {
        waypoints: waypoints.map(w => ({ id: w.id, query: w.query, lat: w.lat, lon: w.lon })),
        flightStyle: activeFlightStyle,
        duration: activeDuration,
        resolution: activeResolution,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {}
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.waypoints?.length >= 2) {
        waypoints = s.waypoints.map((w: any) => ({ ...w, loading: false, results: [], isOpen: false }));
      }
      if (s.flightStyle) activeFlightStyle = s.flightStyle;
      if (s.duration) activeDuration = s.duration;
      if (s.resolution) activeResolution = s.resolution;
    } catch {}
  }

  function loadSearchHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) searchHistory = JSON.parse(raw);
    } catch {}
  }

  function addToSearchHistory(query: string, lat: number, lon: number) {
    // Deduplicate by query name
    searchHistory = [{ query, lat, lon }, ...searchHistory.filter(h => h.query !== query)].slice(0, 10);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory)); } catch {}
  }

  // Restore on mount
  if (typeof window !== 'undefined') {
    restoreSession();
    loadSearchHistory();
  }

  function addWaypoint() {
    waypoints.push({ id: Math.random().toString(36).slice(2), query: '', lat: null, lon: null, loading: false, results: [], isOpen: false });
  }

  function removeWaypoint(index: number) {
    if (waypoints.length > 2) {
      waypoints.splice(index, 1);
    }
  }

  async function performSearch(index: number, q: string) {
    const wp = waypoints[index];
    if (!q || q.length < 2) {
      wp.results = [];
      wp.isOpen = false;
      return;
    }
    wp.loading = true;
    wp.isOpen = true;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=in&format=json&limit=5`);
      if (res.ok) {
        wp.results = await res.json();
      }
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      wp.loading = false;
    }
  }

  function handleInput(index: number, e: Event) {
    const val = (e.target as HTMLInputElement).value;
    waypoints[index].query = val;
    waypoints[index].lat = null;
    waypoints[index].lon = null;
    
    clearTimeout(searchTimeouts[waypoints[index].id]);
    searchTimeouts[waypoints[index].id] = setTimeout(() => performSearch(index, val), 500);
  }

  function selectResult(index: number, result: any) {
    const wp = waypoints[index];
    wp.lat = parseFloat(result.lat);
    wp.lon = parseFloat(result.lon);
    wp.query = result.display_name.split(',')[0];
    wp.isOpen = false;
    
    addToSearchHistory(wp.query, wp.lat!, wp.lon!);
    saveSession();
    
    // Quick preview
    const map = get(mapInstance);
    if (map) {
      map.flyTo({ center: [wp.lon, wp.lat], zoom: 10, pitch: 45, duration: 1500, essential: true });
    }
  }

  function selectFromHistory(index: number, h: { query: string; lat: number; lon: number }) {
    const wp = waypoints[index];
    wp.lat = h.lat;
    wp.lon = h.lon;
    wp.query = h.query;
    wp.isOpen = false;
    wp.results = [];
    saveSession();
    const map = get(mapInstance);
    if (map) map.flyTo({ center: [h.lon, h.lat], zoom: 10, pitch: 45, duration: 1500, essential: true });
  }

  function flyToAsync(map: maplibregl.Map, options: maplibregl.FlyToOptions): Promise<void> {
    return new Promise((resolve) => {
      map.flyTo(options);
      map.once('moveend', () => resolve());
    });
  }

  /** Wait until all visible tiles are fully loaded — prevents blank/blur frames */
  function waitForTilesLoaded(map: any): Promise<void> {
    return new Promise((resolve) => {
      if (map.areTilesLoaded()) { resolve(); return; }
      const check = () => {
        if (map.areTilesLoaded()) { map.off('sourcedata', check); resolve(); }
      };
      map.on('sourcedata', check);
      // Safety timeout so we never hang forever
      setTimeout(() => { map.off('sourcedata', check); resolve(); }, 5000);
    });
  }

  function loadTemplate(t: typeof routeTemplates[0]) {
    waypoints = t.points.map((p, i) => ({
      id: i === 0 ? 'start' : i === t.points.length - 1 ? 'end' : Math.random().toString(36).slice(2),
      query: p.q, lat: p.lat, lon: p.lon,
      loading: false, results: [], isOpen: false,
    }));
    isExpanded = true;
    // Preview the first point
    const map = get(mapInstance);
    if (map) map.flyTo({ center: [t.points[0].lon, t.points[0].lat], zoom: 6, pitch: 45, duration: 1500 });
  }

  async function runFlightChoreography(map: any, validWaypoints: Waypoint[], totalMs: number) {
    const n = validWaypoints.length;
    const perPointMs = totalMs / n;

    switch (activeFlightStyle) {
      case 'orbit':
        for (const wp of validWaypoints) {
          await flyToAsync(map, { center: [wp.lon!, wp.lat!], zoom: 13, pitch: 60, bearing: 0, duration: perPointMs * 0.3, essential: true });
          await waitForTilesLoaded(map);
          const steps = 60;
          for (let s = 0; s < steps; s++) {
            map.setBearing((360 / steps) * (s + 1));
            await new Promise(r => setTimeout(r, (perPointMs * 0.7) / steps));
          }
        }
        break;

      case 'dronerise':
        for (const wp of validWaypoints) {
          await flyToAsync(map, { center: [wp.lon!, wp.lat!], zoom: 16, pitch: 80, bearing: 0, duration: perPointMs * 0.2, essential: true });
          await waitForTilesLoaded(map);
          await flyToAsync(map, { center: [wp.lon!, wp.lat!], zoom: 8, pitch: 30, bearing: 45, duration: perPointMs * 0.8, essential: true });
          await waitForTilesLoaded(map);
        }
        break;

      case 'tracking': {
        const coords = validWaypoints.map(w => [w.lon!, w.lat!]);
        const line = turf.lineString(coords);
        const curved = turf.bezierSpline(line, { resolution: 10000 });
        const totalLength = turf.length(curved);
        const steps = Math.round(totalMs / 50);
        // Pre-warm: fly to start and wait for tiles
        const startPt = turf.along(curved, 0);
        map.jumpTo({ center: startPt.geometry.coordinates as [number, number], zoom: 13, pitch: 65 });
        await waitForTilesLoaded(map);
        for (let s = 0; s <= steps; s++) {
          const dist = (s / steps) * totalLength;
          const pt = turf.along(curved, dist);
          const [lng, lat] = pt.geometry.coordinates;
          const nextDist = Math.min(dist + 0.5, totalLength);
          const nextPt = turf.along(curved, nextDist);
          const bearing = turf.bearing(pt, nextPt);
          map.jumpTo({ center: [lng, lat], zoom: 13, pitch: 65, bearing });
          await new Promise(r => setTimeout(r, 50));
        }
        break;
      }

      case 'timelapse':
        for (const wp of validWaypoints) {
          await flyToAsync(map, { center: [wp.lon!, wp.lat!], zoom: 3, pitch: 0, bearing: 0, duration: 500, essential: true });
          await waitForTilesLoaded(map);
          await flyToAsync(map, { center: [wp.lon!, wp.lat!], zoom: 14, pitch: 60, bearing: 30, duration: perPointMs - 500, essential: true });
          await waitForTilesLoaded(map);
          await new Promise(r => setTimeout(r, 800));
        }
        break;

      case 'parallax':
        for (let i = 0; i < n; i++) {
          const wp = validWaypoints[i];
          const bearingBase = i * 40;
          await flyToAsync(map, { center: [wp.lon!, wp.lat!], zoom: 12, pitch: 55, bearing: bearingBase, duration: perPointMs * 0.4, essential: true });
          await waitForTilesLoaded(map);
          const driftSteps = 40;
          for (let s = 0; s < driftSteps; s++) {
            map.setBearing(bearingBase + Math.sin(s / 5) * 15);
            map.setPitch(55 + Math.sin(s / 8) * 8);
            await new Promise(r => setTimeout(r, (perPointMs * 0.6) / driftSteps));
          }
        }
        break;

      default: // flythrough
        for (let i = 0; i < n; i++) {
          const wp = validWaypoints[i];
          const pitch = i === 0 ? 60 : (i === n - 1 ? 40 : 55);
          let bearing = 0;
          if (i < n - 1) {
            const next = validWaypoints[i + 1];
            bearing = turf.bearing(turf.point([wp.lon!, wp.lat!]), turf.point([next.lon!, next.lat!]));
          }
          await flyToAsync(map, { center: [wp.lon!, wp.lat!], zoom: 11.5, pitch, bearing, speed: 0.3, curve: 1.2, essential: true, duration: i === 0 ? perPointMs * 0.3 : perPointMs * 0.8 });
          await waitForTilesLoaded(map);
          await new Promise(r => setTimeout(r, 1000));
        }
    }
  }

  async function previewFlight() {
    const map = get(mapInstance);
    const valid = waypoints.filter(w => w.lat !== null && w.lon !== null);
    if (!map || valid.length < 2) return;
    isPreviewing = true;
    await runFlightChoreography(map, valid, durations.find(d => d.key === activeDuration)!.ms);
    isPreviewing = false;
  }

  async function startCinematicRecording() {
    const map = get(mapInstance);
    const validWaypoints = waypoints.filter(w => w.lat !== null && w.lon !== null);
    
    if (!map || validWaypoints.length < 2) {
      alert("Please select at least 2 valid locations.");
      return;
    }

    const res = resolutions.find(r => r.key === activeResolution)!;
    const totalMs = durations.find(d => d.key === activeDuration)!.ms;

    recordingMode.set(true);
    isRecording = true;
    recordedChunks = [];

    // Force canvas size for selected resolution
    const container = map.getContainer();
    const originalWidth = container.style.width;
    const originalHeight = container.style.height;
    const originalPosition = container.style.position;
    
    container.style.width = res.w + 'px';
    container.style.height = res.h + 'px';
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.zIndex = '9999';
    map.resize();

    await new Promise(r => setTimeout(r, 1000));

    // Draw route line
    const coords = validWaypoints.map(w => [w.lon!, w.lat!]);
    const lineString = turf.lineString(coords);
    const curved = turf.bezierSpline(lineString, { resolution: 10000 });

    if (map.getSource('cinematic-route')) {
      (map.getSource('cinematic-route') as any).setData(curved);
    } else {
      map.addSource('cinematic-route', { type: 'geojson', data: curved });
      if (!map.getLayer('cinematic-route-glow')) {
        map.addLayer({ id: 'cinematic-route-glow', type: 'line', source: 'cinematic-route', paint: { 'line-color': '#10b981', 'line-width': 10, 'line-blur': 8, 'line-opacity': 0.5 } });
      }
      if (!map.getLayer('cinematic-route-line')) {
        map.addLayer({ id: 'cinematic-route-line', type: 'line', source: 'cinematic-route', paint: { 'line-color': '#34d399', 'line-width': 3 } });
      }
    }

    // Start recording
    const canvas = map.getCanvas();
    const stream = canvas.captureStream(60);
    const bitrate = activeResolution === '4k' ? 50000000 : activeResolution === '1080p' ? 25000000 : 12000000;
    
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: bitrate });
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      isRecording = false;
      isRendering = true;
      
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `cinematic-${activeFlightStyle}-${activeResolution}-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        isRendering = false;
        recordingMode.set(false);
        
        container.style.width = originalWidth;
        container.style.height = originalHeight;
        container.style.position = originalPosition;
        container.style.top = '';
        container.style.left = '';
        container.style.transform = '';
        container.style.zIndex = '';
        map.resize();
        
        if (map.getLayer('cinematic-route-glow')) map.removeLayer('cinematic-route-glow');
        if (map.getLayer('cinematic-route-line')) map.removeLayer('cinematic-route-line');
        if (map.getSource('cinematic-route')) map.removeSource('cinematic-route');
      }, 100);
    };

    mediaRecorder.start();

    // Run the selected flight choreography
    await runFlightChoreography(map, validWaypoints, totalMs);

    // Stop recording after flight finishes
    setTimeout(() => {
      if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    }, 1000);
  }
</script>

{#if !$recordingMode}
<div class="cinematic-bar" class:expanded={isExpanded}>
  <div class="waypoints-list">
    {#each waypoints.slice(0, isExpanded ? waypoints.length : 1) as wp, i}
      <div class="waypoint-row">
        <div class="wp-icon">
          {#if !isExpanded}
            <Search size={16} color="var(--text-tertiary)" />
          {:else if i === 0}
            <MapPin size={16} color="#10b981" />
          {:else if i === waypoints.length - 1}
            <MapPin size={16} color="#ef4444" />
          {:else}
            <div class="wp-dot"></div>
          {/if}
        </div>
        
        <div class="search-input-wrapper">
          <input 
            type="text" 
            placeholder={!isExpanded ? "Search places or build a route..." : (i === 0 ? "Start Location" : (i === waypoints.length - 1 ? "End Location" : `Waypoint ${i}`))}
            value={wp.query}
            oninput={(e) => handleInput(i, e)}
            onfocus={() => { 
              isExpanded = true;
              if(wp.query.length > 1) wp.isOpen = true;
              else if (!wp.query && searchHistory.length > 0) wp.isOpen = true;
            }}
          />
          {#if wp.loading}
            <Loader2 size={14} class="spinner" style="animation: spin 1s linear infinite;" />
          {/if}
          
          {#if wp.isOpen && wp.results.length > 0}
            <div class="search-dropdown">
              {#each wp.results as result}
                <button class="search-result" onclick={() => selectResult(i, result)}>
                  <MapPin size={14} class="result-icon" />
                  <div class="result-text">
                    <span class="result-main">{result.display_name.split(',')[0]}</span>
                    <span class="result-sub">{result.display_name.split(',').slice(1).join(',')}</span>
                  </div>
                </button>
              {/each}
            </div>
          {:else if wp.isOpen && wp.results.length === 0 && !wp.loading && searchHistory.length > 0 && !wp.query}
            <div class="search-dropdown">
              <div class="history-header">Recent</div>
              {#each searchHistory.slice(0, 5) as h}
                <button class="search-result" onclick={() => selectFromHistory(i, h)}>
                  <MapPin size={14} class="result-icon" />
                  <div class="result-text">
                    <span class="result-main">{h.query}</span>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        
        {#if isExpanded && waypoints.length > 2}
          <button class="btn-icon" onclick={() => removeWaypoint(i)} title="Remove Waypoint">
            <Trash2 size={14} />
          </button>
        {/if}
        
        {#if !isExpanded}
          <button class="btn-icon" onclick={() => isExpanded = true} title="Cinematic Route Builder">
            <Video size={14} />
          </button>
        {/if}
      </div>
    {/each}
  </div>

  {#if isExpanded}
  <!-- Flight Style Selector -->
  <div class="studio-section">
    <span class="studio-label">Flight Style</span>
    <div class="style-row">
      {#each flightStyles as fs}
        <button class="flight-pill" class:active={activeFlightStyle === fs.key} onclick={() => { activeFlightStyle = fs.key; saveSession(); }} title={fs.desc}>
          <fs.icon size={12} />
          <span>{fs.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Duration + Resolution -->
  <div class="studio-section" style="display: flex; gap: 12px;">
    <div style="flex: 1;">
      <span class="studio-label">Duration</span>
      <div class="pill-row">
        {#each durations as d}
          <button class="mini-pill" class:active={activeDuration === d.key} onclick={() => { activeDuration = d.key; saveSession(); }}>{d.label}</button>
        {/each}
      </div>
    </div>
    <div style="flex: 1;">
      <span class="studio-label">Resolution</span>
      <div class="pill-row">
        {#each resolutions as r}
          <button class="mini-pill" class:active={activeResolution === r.key} onclick={() => { activeResolution = r.key; saveSession(); }}>{r.key}</button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Route Templates -->
  <div class="studio-section">
    <span class="studio-label">Quick Routes</span>
    <div class="template-row">
      {#each routeTemplates as t}
        <button class="template-chip" onclick={() => loadTemplate(t)} title={t.desc}>
          {t.name}
        </button>
      {/each}
    </div>
  </div>

  <div class="bar-actions">
    <button class="btn btn-ghost" onclick={addWaypoint}>
      <Plus size={14} /> Add Stop
    </button>
    <div class="spacer"></div>
    <button class="btn btn-ghost" onclick={previewFlight} disabled={isPreviewing || isRecording} title="Preview flight without recording">
      {#if isPreviewing}
        <Loader2 size={14} style="animation: spin 1s linear infinite;" /> Previewing...
      {:else}
        <Eye size={14} /> Preview
      {/if}
    </button>
    <button class="btn-icon" onclick={() => { isExpanded = false; }} title="Close Builder" style="margin-right: 4px;">
      <X size={14} />
    </button>
    <button class="btn btn-primary record-btn" onclick={startCinematicRecording} disabled={isRecording || isRendering || isPreviewing}>
      {#if isRecording}
        <Loader2 size={14} style="animation: spin 1s linear infinite;" /> Recording...
      {:else if isRendering}
        <Loader2 size={14} style="animation: spin 1s linear infinite;" /> Exporting...
      {:else}
        <Video size={14} /> Record {activeResolution}
      {/if}
    </button>
  </div>
  {/if}
</div>
{/if}

<style>
  .cinematic-bar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 460px;
    background: rgba(10, 10, 15, 0.82);
    backdrop-filter: blur(32px) saturate(200%);
    -webkit-backdrop-filter: blur(32px) saturate(200%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 8px 12px;
    z-index: var(--z-toolbar, 200);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .waypoints-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .waypoint-row {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    padding: 4px 8px;
    border-radius: 12px;
    transition: background 0.2s;
  }
  
  .waypoint-row:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .wp-icon {
    width: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .wp-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-primary);
    box-shadow: 0 0 8px var(--accent-primary-glow);
  }

  .search-input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    height: 32px;
  }

  .search-input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    width: 100%;
    letter-spacing: -0.01em;
  }
  
  .search-input-wrapper input::placeholder {
    color: var(--text-tertiary);
    font-weight: 400;
  }

  .spinner {
    animation: spin 1s linear infinite;
    color: var(--text-secondary);
  }

  .search-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: rgba(15, 15, 22, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    overflow: hidden;
    z-index: 10;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    max-height: 250px;
    overflow-y: auto;
  }

  .search-result {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;
  }

  .search-result:last-child {
    border-bottom: none;
  }

  .search-result:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .result-icon {
    color: var(--text-tertiary);
    flex-shrink: 0;
  }

  .result-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .result-main {
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-sub {
    font-size: 11px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .spacer {
    flex: 1;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
  }

  .btn-ghost:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover {
    filter: brightness(1.1);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .record-btn {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }

  .record-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #f87171, #ef4444);
    box-shadow: 0 6px 16px rgba(239, 68, 68, 0.5);
  }

  .btn-icon {
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-icon:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  @keyframes spin { 100% { transform: rotate(360deg); } }

  /* Studio Sections */
  .studio-section {
    padding: 6px 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
  .studio-label {
    font-size: 9px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
    display: block;
  }
  .style-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .flight-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-tertiary);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  .flight-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-secondary);
  }
  .flight-pill.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    box-shadow: 0 0 8px rgba(99, 102, 241, 0.2);
  }
  .pill-row {
    display: flex;
    gap: 4px;
  }
  .mini-pill {
    flex: 1;
    padding: 4px 6px;
    border-radius: 4px;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-tertiary);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
  }
  .mini-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-secondary);
  }
  .mini-pill.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  .template-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .template-chip {
    padding: 4px 8px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-secondary);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  .template-chip:hover {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #34d399;
  }
  .history-header {
    padding: 6px 12px 4px;
    font-size: 9px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  /* Light theme overrides */
  :global(.light-theme) .cinematic-bar {
    background: rgba(255, 255, 255, 0.65);
    border-color: rgba(0, 0, 0, 0.08);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }
  :global(.light-theme) .waypoint-row:hover {
    background: rgba(0, 0, 0, 0.03);
  }
  :global(.light-theme) .search-dropdown {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(0, 0, 0, 0.1);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
  :global(.light-theme) .search-result {
    border-bottom-color: rgba(0, 0, 0, 0.06);
  }
  :global(.light-theme) .search-result:hover {
    background: rgba(0, 0, 0, 0.04);
  }
  :global(.light-theme) .bar-actions {
    border-top-color: rgba(0, 0, 0, 0.06);
  }
  :global(.light-theme) .btn-ghost:hover {
    background: rgba(0, 0, 0, 0.05);
  }
</style>
