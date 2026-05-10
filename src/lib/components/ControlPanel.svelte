<script lang="ts">
  import {
    activeStyle, viewSettings, visualFilters,
    exportSettings, mapStyles, mapInstance, cameraState,
    panelOpen, activeTab, presets, show3DOverlay,
    type MapStyleKey, type MapPreset
  } from '$lib/stores/mapStore';
  import {
    stateOverlayVisible, indiaFocusMode, overlayMetric,
    overlayOpacity, statesByMetric, selectedStateName,
    cityPinsVisible, boundaryDetail, activeThematicFilter,
  } from '$lib/stores/indiaGeoStore';
  import { METRIC_CONFIGS, INDIA_BOUNDS, type OverlayMetric } from '$lib/data/indiaConstants';
  import { formatIndianNumber } from '$lib/data/countryData';
  import { get } from 'svelte/store';
  import {
    Globe, Palette, Sparkles, Camera, Zap, X, Menu,
    Users, Coins, BookOpen, Ruler, Eye, EyeOff, Lock,
    BarChart3, MapPin, RotateCcw, Layers, SlidersHorizontal, Video, Box,
  } from '@lucide/svelte';

  import { trackStyleChange, trackPreset } from '$lib/utils/analytics';



  const tabs = [
    { key: 'india' as const, label: 'India', icon: '🇮🇳' },
    { key: 'filters' as const, label: 'Filters', icon: '✨' },
    { key: 'export' as const, label: 'Export', icon: '📸' },
    { key: 'presets' as const, label: 'Presets', icon: '⚡' },
  ];

  function setStyle(key: MapStyleKey) {
    activeStyle.set(key);
  }

  function resetFilters() {
    visualFilters.set({
      brightness: 1.0, contrast: 1.0, saturation: 1.0,
      hueRotate: 0, sepia: 0, grayscale: 0,
    });
  }

  function applyPreset(preset: MapPreset) {
    activeStyle.set(preset.style);
    viewSettings.update((v) => ({ ...v, terrainExaggeration: preset.exaggeration }));
    visualFilters.set({ ...preset.filters });

    const map = get(mapInstance);
    if (map) {
      map.flyTo({
        center: [preset.lng, preset.lat],
        zoom: preset.zoom,
        pitch: preset.pitch,
        bearing: preset.bearing,
        duration: 3000,
        essential: true,
      });
    }
  }

  function handleExport() {
    const map = get(mapInstance);
    if (!map) return;
    const canvas = map.getCanvas();
    const settings = get(exportSettings);
    const mimeType = settings.format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, settings.quality);
    const link = document.createElement('a');
    link.download = `india-map-${Date.now()}.${settings.format}`;
    link.href = dataUrl;
    link.click();
  }

  function copyToClipboard() {
    const map = get(mapInstance);
    if (!map) return;
    const canvas = map.getCanvas();
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
      } catch { /* clipboard denied */ }
    });
  }

  function togglePanel() {
    panelOpen.update((v) => !v);
  }

  function setPitch(val: number) {
    cameraState.update((c) => ({ ...c, pitch: val }));
    get(mapInstance)?.setPitch(val);
  }
  function setBearing(val: number) {
    cameraState.update((c) => ({ ...c, bearing: val }));
    get(mapInstance)?.setBearing(val);
  }
  function setExaggeration(val: number) {
    viewSettings.update((v) => ({ ...v, terrainExaggeration: val }));
  }
  function setFogEnabled(val: boolean) {
    viewSettings.update((v) => ({ ...v, fog: val }));
  }
  function setFogDensity(val: number) {
    viewSettings.update((v) => ({ ...v, fogDensity: val }));
  }
  function setBuildings(val: boolean) {
    viewSettings.update((v) => ({ ...v, buildings3D: val }));
  }
  function setSkyAtmosphere(val: boolean) {
    viewSettings.update((v) => ({ ...v, skyAtmosphere: val }));
  }

  function flyToIndia() {
    const map = get(mapInstance);
    if (map) {
      map.flyTo({
        center: [78.9629, 22.0],
        zoom: 4.5,
        pitch: 0,
        bearing: 0,
        duration: 2000,
      });
    }
  }

  const metricOptions: { key: OverlayMetric; label: string; icon: typeof Users }[] = [
    { key: 'population', label: 'Population', icon: Users },
    { key: 'gdpBillionUsd', label: 'GDP', icon: Coins },
    { key: 'literacy', label: 'Literacy', icon: BookOpen },
    { key: 'area', label: 'Area', icon: Ruler },
  ];

  const currentMetricConfig = $derived(METRIC_CONFIGS[$overlayMetric]);
  const topStates = $derived($statesByMetric.slice(0, 5));
</script>

{#if !$panelOpen}
  <button class="panel-toggle-btn" onclick={togglePanel} title="Open Controls">
    <Menu size={18} />
  </button>
{/if}

{#if $panelOpen}
  <div class="control-panel glass-panel" id="control-panel">
    <div class="panel-header">
      <div class="panel-brand">
        <div class="brand-left">
          <span class="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L8 6l2 4-4 2 2 4-2 4h12l-2-4 2-4-4-2 2-4-4-4z" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </span>
          <h1 class="brand-title">Yupcha Map</h1>
        </div>
        <button class="btn btn-icon" onclick={togglePanel} title="Collapse panel"><X size={16} /></button>
      </div>

      <div class="tab-bar">
      {#each tabs as tab}
        <button
          class="tab-btn"
          class:active={$activeTab === tab.key}
          onclick={() => activeTab.set(tab.key)}
        >
          <span class="tab-icon">
            {#if tab.key === 'india'}<Globe size={14} />
            {:else if tab.key === 'filters'}<SlidersHorizontal size={14} />
            {:else if tab.key === 'export'}<Camera size={14} />
            {:else if tab.key === 'presets'}<Zap size={14} />
            {/if}
          </span>
          <span class="tab-label">{tab.label}</span>
        </button>
      {/each}
      </div>
    </div>

    <div class="panel-content">
      {#if $activeTab === 'filters'}
        <div class="tab-section">
          <div class="section-title">Visual Filters</div>
          <div class="slider-container">
            <span class="slider-label">Brightness</span>
            <input type="range" min="0.5" max="2" step="0.05" value={$visualFilters.brightness}
              oninput={(e) => visualFilters.update(f => ({...f, brightness: Number(e.currentTarget.value)}))} />
            <span class="slider-value">{$visualFilters.brightness.toFixed(2)}</span>
          </div>
          <div class="slider-container">
            <span class="slider-label">Contrast</span>
            <input type="range" min="0.5" max="2" step="0.05" value={$visualFilters.contrast}
              oninput={(e) => visualFilters.update(f => ({...f, contrast: Number(e.currentTarget.value)}))} />
            <span class="slider-value">{$visualFilters.contrast.toFixed(2)}</span>
          </div>
          <div class="slider-container">
            <span class="slider-label">Saturation</span>
            <input type="range" min="0" max="2" step="0.05" value={$visualFilters.saturation}
              oninput={(e) => visualFilters.update(f => ({...f, saturation: Number(e.currentTarget.value)}))} />
            <span class="slider-value">{$visualFilters.saturation.toFixed(2)}</span>
          </div>
          <div class="slider-container">
            <span class="slider-label">Hue Rotate</span>
            <input type="range" min="0" max="360" step="5" value={$visualFilters.hueRotate}
              oninput={(e) => visualFilters.update(f => ({...f, hueRotate: Number(e.currentTarget.value)}))} />
            <span class="slider-value">{$visualFilters.hueRotate}°</span>
          </div>
          <div class="slider-container">
            <span class="slider-label">Sepia</span>
            <input type="range" min="0" max="100" step="5" value={$visualFilters.sepia}
              oninput={(e) => visualFilters.update(f => ({...f, sepia: Number(e.currentTarget.value)}))} />
            <span class="slider-value">{$visualFilters.sepia}%</span>
          </div>
          <div class="slider-container">
            <span class="slider-label">Grayscale</span>
            <input type="range" min="0" max="100" step="5" value={$visualFilters.grayscale}
              oninput={(e) => visualFilters.update(f => ({...f, grayscale: Number(e.currentTarget.value)}))} />
            <span class="slider-value">{$visualFilters.grayscale}%</span>
          </div>
          <button class="btn" style="margin-top: 12px; width: 100%;" onclick={resetFilters}>
            🔄 Reset All Filters
          </button>
        </div>
      {/if}

      {#if $activeTab === 'export'}
        <div class="tab-section">
          <div class="section-title">Format</div>
          <div class="chip-grid" style="grid-template-columns: repeat(2, 1fr);">
            {#each (['png', 'jpeg'] as const) as fmt}
              <button class="chip" class:active={$exportSettings.format === fmt}
                onclick={() => exportSettings.update(s => ({...s, format: fmt}))}>
                {fmt.toUpperCase()}
              </button>
            {/each}
          </div>
          {#if $exportSettings.format === 'jpeg'}
            <div class="section-title">Quality</div>
            <div class="slider-container">
              <span class="slider-label">JPEG Quality</span>
              <input type="range" min="0.1" max="1" step="0.05" value={$exportSettings.quality}
                oninput={(e) => exportSettings.update(s => ({...s, quality: Number(e.currentTarget.value)}))} />
              <span class="slider-value">{Math.round($exportSettings.quality * 100)}%</span>
            </div>
          {/if}
          <div class="section-title">Pixel Ratio</div>
          <div class="slider-container">
            <span class="slider-label">DPI Scale</span>
            <input type="range" min="1" max="4" step="1" value={$exportSettings.pixelRatio}
              oninput={(e) => exportSettings.update(s => ({...s, pixelRatio: Number(e.currentTarget.value)}))} />
            <span class="slider-value">{$exportSettings.pixelRatio}x</span>
          </div>
          <div class="export-actions">
            <button class="btn btn-accent" style="flex:1;" onclick={handleExport}>
              📸 Export Screenshot
            </button>
            <button class="btn" onclick={copyToClipboard} title="Copy to clipboard">
              📋
            </button>
          </div>
        </div>
      {/if}

      {#if $activeTab === 'presets'}
        <div class="tab-section">
          <div class="section-title">Story Filters</div>
          <p style="font-size: 10px; color: var(--text-tertiary); margin-bottom: 8px;">Highlight cities by industry & tag</p>
          <div class="chip-grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom: 16px;">
            <button class="chip" class:active={$activeThematicFilter === null} onclick={() => activeThematicFilter.set(null)}>All Cities</button>
            <button class="chip" class:active={$activeThematicFilter === 'tech'} onclick={() => activeThematicFilter.set('tech')}>💻 Tech Hubs</button>
            <button class="chip" class:active={$activeThematicFilter === 'film'} onclick={() => activeThematicFilter.set('film')}>🎬 Film & Cinema</button>
            <button class="chip" class:active={$activeThematicFilter === 'tourism'} onclick={() => activeThematicFilter.set('tourism')}>🏰 Tourism</button>
            <button class="chip" class:active={$activeThematicFilter === 'textiles'} onclick={() => activeThematicFilter.set('textiles')}>🧵 Textiles</button>
            <button class="chip" class:active={$activeThematicFilter === 'port'} onclick={() => activeThematicFilter.set('port')}>⚓ Major Ports</button>
          </div>

          <div class="section-title">Visual Presets</div>
          <div class="preset-list">
            {#each presets as preset}
              <button class="preset-card" onclick={() => { applyPreset(preset); trackPreset(preset.name); }}>
                <span class="preset-icon">{preset.icon}</span>
                <div class="preset-info">
                  <span class="preset-name">{preset.name}</span>
                  <span class="preset-desc">{preset.description}</span>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if $activeTab === 'india'}
        <div class="tab-section">
          <div class="section-title">State Boundaries</div>
          <div class="control-row">
            <span class="control-label">Show Boundaries</span>
            <label class="toggle">
              <input type="checkbox" checked={$stateOverlayVisible}
                onchange={(e) => stateOverlayVisible.set(e.currentTarget.checked)} />
              <span class="toggle-track"></span>
            </label>
          </div>
          {#if $stateOverlayVisible}
            <div class="control-row" style="margin-top: -6px; margin-bottom: 8px;">
              <div class="segmented-control">
                <button class="segment" class:active={$boundaryDetail === 'states'}
                  onclick={() => boundaryDetail.set('states')}>States</button>
                <button class="segment" class:active={$boundaryDetail === 'districts'}
                  onclick={() => boundaryDetail.set('districts')}>Districts</button>
              </div>
            </div>
          {/if}
          <div class="control-row">
            <span class="control-label">India Focus Lock</span>
            <label class="toggle">
              <input type="checkbox" checked={$indiaFocusMode}
                onchange={(e) => indiaFocusMode.set(e.currentTarget.checked)} />
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="control-row">
            <span class="control-label">City Pins</span>
            <label class="toggle">
              <input type="checkbox" checked={$cityPinsVisible}
                onchange={(e) => cityPinsVisible.set(e.currentTarget.checked)} />
              <span class="toggle-track"></span>
            </label>
          </div>

          <div class="section-title">Choropleth Metric</div>
          <div class="chip-grid">
            {#each metricOptions as opt}
              <button class="chip" class:active={$overlayMetric === opt.key}
                onclick={() => overlayMetric.set(opt.key)}>
                <opt.icon size={13} /> {opt.label}
              </button>
            {/each}
          </div>

          <div class="section-title">Overlay Opacity</div>
          <div class="slider-container">
            <span class="slider-label">Opacity</span>
            <input type="range" min="0.1" max="1" step="0.05" value={$overlayOpacity}
              oninput={(e) => overlayOpacity.set(Number(e.currentTarget.value))} />
            <span class="slider-value">{Math.round($overlayOpacity * 100)}%</span>
          </div>
          <div class="chip-grid" style="margin-top: 4px;">
            {#each [0.25, 0.5, 0.75, 1] as preset}
              <button class="chip chip-sm" class:active={Math.abs($overlayOpacity - preset) < 0.03}
                onclick={() => overlayOpacity.set(preset)}>
                {Math.round(preset * 100)}%
              </button>
            {/each}
          </div>

          <div class="section-title">Choropleth Legend</div>
          <div class="legend-bar">
            <div class="legend-gradient" style:background="linear-gradient(90deg, {currentMetricConfig.colors[0]}, {currentMetricConfig.colors[1]}, {currentMetricConfig.colors[2]})"></div>
            <div class="legend-labels">
              <span>{currentMetricConfig.format(currentMetricConfig.min)}</span>
              <span>{currentMetricConfig.format(currentMetricConfig.max)}</span>
            </div>
          </div>

          {#if $cityPinsVisible}
            <div class="section-title">City Pin Legend</div>
            <div class="pin-legend">
              <div class="pin-legend-item"><span class="pin-dot" style="background:#6366f1"></span> Metro (10M+)</div>
              <div class="pin-legend-item"><span class="pin-dot" style="background:#06b6d4"></span> Tier 1 (3-10M)</div>
              <div class="pin-legend-item"><span class="pin-dot" style="background:#f59e0b"></span> Tier 2</div>
              <div class="pin-legend-item"><span class="pin-dot" style="background:#10b981"></span> Tier 3 / Hill</div>
              <div class="pin-legend-item"><span class="pin-dot" style="background:#a855f7"></span> UT Capital</div>
              <div class="pin-legend-item"><span class="pin-dot" style="background:#ef4444"></span> Landmark</div>
            </div>
          {/if}

          <div class="section-title">Top 5 — {currentMetricConfig.label}</div>
          <div class="india-ranks">
            {#each topStates as state, i}
              <button class="india-rank-row"
                class:selected={$selectedStateName === state.name}
                onclick={() => selectedStateName.set(state.name)}>
                <span class="rank-num">#{i + 1}</span>
                <span class="rank-state-name">{state.name}</span>
                <span class="rank-state-val">{currentMetricConfig.format(state[$overlayMetric] as number)}</span>
              </button>
            {/each}
          </div>

          <button class="btn" style="margin-top: 12px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick={flyToIndia}>
            <RotateCcw size={14} /> Reset to India View
          </button>

          <div class="section-title" style="margin-top: 16px;">3D Visualization</div>
          <div class="control-row">
            <span class="control-label"><Box size={14} style="display:inline" /> 3D Data Bars</span>
            <label class="toggle">
              <input type="checkbox" checked={$show3DOverlay}
                onchange={(e) => show3DOverlay.set(e.currentTarget.checked)} />
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>
      {/if}


    </div>
  </div>
{/if}

<style>
  .panel-toggle-btn {
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: var(--z-toolbar, 200);
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    color: var(--text-primary);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-md);
    animation: fadeIn 200ms ease;
  }
  .panel-toggle-btn:hover {
    background: var(--bg-panel-hover);
    transform: scale(1.05);
  }

  .control-panel {
    position: fixed;
    top: 12px;
    left: 12px;
    bottom: 12px;
    width: 272px;
    z-index: var(--z-panel, 100);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideInLeft 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .panel-header {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-subtle);
    gap: 8px;
  }
  .panel-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brand-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    border-radius: 5px;
    box-shadow: var(--shadow-sm);
    color: white;
  }
  .brand-icon svg {
    width: 12px;
    height: 12px;
  }
  .brand-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .tab-bar {
    display: flex;
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-sm);
    padding: 3px;
    gap: 1px;
  }
  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 5px 3px;
    border: none;
    background: transparent;
    border-radius: 4px;
    color: var(--text-tertiary);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .tab-btn:hover {
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.05);
  }
  .tab-btn.active {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.1);
    box-shadow: var(--shadow-sm);
  }
  .tab-icon {
    display: flex;
    align-items: center;
  }
  .tab-label {
    display: none;
  }
  .tab-btn.active .tab-label {
    display: block;
  }
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px;
  }
  .tab-section { animation: fadeIn 200ms ease; }

  .export-actions {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-lg);
  }

  .preset-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .preset-card {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--bg-control);
    cursor: pointer;
    transition: all var(--transition-normal);
    text-align: left;
    width: 100%;
    font-family: var(--font-sans);
    color: var(--text-primary);
  }
  .preset-card:hover {
    background: var(--bg-control-hover);
    border-color: var(--border-medium);
    transform: translateX(4px);
  }
  .preset-icon { font-size: 24px; }
  .preset-info { display: flex; flex-direction: column; }
  .preset-name { font-size: 13px; font-weight: 600; }
  .preset-desc { font-size: 11px; color: var(--text-tertiary); }

  /* Preset List */
  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  /* India Tab Styles */
  .legend-bar {
    margin-top: 4px;
  }
  .legend-gradient {
    height: 10px;
    border-radius: 5px;
    border: 1px solid var(--border-subtle);
  }
  .legend-labels {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: var(--text-tertiary);
    font-family: var(--font-mono);
    margin-top: 3px;
  }

  .india-ranks {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .india-rank-row {
    display: grid;
    grid-template-columns: 26px 1fr auto;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    background: var(--bg-control);
    cursor: pointer;
    transition: all var(--transition-normal);
    font-family: var(--font-sans);
    color: var(--text-primary);
    font-size: 12px;
    text-align: left;
    width: 100%;
  }
  .india-rank-row:hover {
    background: var(--bg-control-hover);
    border-color: var(--border-medium);
    transform: translateX(3px);
  }
  .india-rank-row.selected {
    border-color: var(--accent-primary);
    background: rgba(99, 102, 241, 0.1);
  }
  .rank-num {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-tertiary);
  }
  .rank-state-name {
    font-weight: 600;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rank-state-val {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-accent);
  }

  .panel-footer {
    padding: var(--space-sm) var(--space-lg);
    border-top: 1px solid var(--border-subtle);
  }
  .camera-readout {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-tertiary);
  }

  /* Pin Legend */
  .pin-legend {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 8px;
    padding: 6px 0;
  }
  .pin-legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--text-secondary);
  }
  .pin-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 4px currentColor;
  }

  /* Small chip variant for opacity presets */
  .chip-sm {
    padding: 3px 10px !important;
    font-size: 10px !important;
    min-width: 42px;
  }

  /* Segmented Control */
  .segmented-control {
    display: flex;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 6px;
    padding: 2px;
    width: 100%;
    border: 1px solid var(--border-subtle);
  }
  .segment {
    flex: 1;
    text-align: center;
    padding: 4px 0;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .segment:hover {
    color: var(--text-primary);
  }
  .segment.active {
    background: var(--bg-control-hover);
    color: var(--accent-primary);
    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }

  /* Light theme overrides */
  :global(.light-theme) .panel-toggle-btn {
    background: rgba(255, 255, 255, 0.7);
    border-color: rgba(0, 0, 0, 0.08);
  }
  :global(.light-theme) .panel-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.85);
  }
  :global(.light-theme) .tab-bar {
    background: rgba(0, 0, 0, 0.05);
  }
  :global(.light-theme) .tab-btn:hover {
    background: rgba(0, 0, 0, 0.05);
  }
  :global(.light-theme) .tab-btn.active {
    background: rgba(255, 255, 255, 0.8);
    color: var(--text-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
  :global(.light-theme) .brand-icon {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }
  :global(.light-theme) .segmented-control {
    background: rgba(0, 0, 0, 0.06);
    border-color: rgba(0, 0, 0, 0.08);
  }
  :global(.light-theme) .segment.active {
    background: rgba(255, 255, 255, 0.85);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
</style>
