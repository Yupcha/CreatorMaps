<script lang="ts">
  import {
    activeStyle, viewSettings, visualFilters,
    exportSettings, mapStyles, mapInstance, cameraState,
    panelOpen, activeTab, presets,
    type MapStyleKey, type MapPreset
  } from '$lib/stores/mapStore';
  import {
    stateOverlayVisible, indiaFocusMode, overlayMetric,
    overlayOpacity, statesByMetric, selectedStateName,
    cityPinsVisible,
  } from '$lib/stores/indiaGeoStore';
  import { METRIC_CONFIGS, INDIA_BOUNDS, type OverlayMetric } from '$lib/data/indiaConstants';
  import { formatIndianNumber } from '$lib/data/countryData';
  import { get } from 'svelte/store';
  import {
    Globe, Palette, Sparkles, Camera, Zap, X, Menu,
    Users, Coins, BookOpen, Ruler, Eye, EyeOff, Lock,
    BarChart3, MapPin, RotateCcw, Layers, SlidersHorizontal,
  } from '@lucide/svelte';

  const tabs = [
    { key: 'india' as const, label: 'India', icon: '🇮🇳' },
    { key: 'view' as const, label: 'View', icon: '🎨' },
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
        <span class="brand-icon"><Globe size={20} color="#a5b4fc" /></span>
        <div>
          <h1 class="brand-title">India 3D Map</h1>
          <p class="brand-sub">Content Creator Toolkit</p>
        </div>
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
            {:else if tab.key === 'view'}<Palette size={14} />
            {:else if tab.key === 'filters'}<SlidersHorizontal size={14} />
            {:else if tab.key === 'export'}<Camera size={14} />
            {:else if tab.key === 'presets'}<Zap size={14} />
            {/if}
          </span>
          <span class="tab-label">{tab.label}</span>
        </button>
      {/each}
    </div>

    <div class="panel-content">
      {#if $activeTab === 'view'}
        <div class="tab-section">
          <div class="section-title">Map Style</div>
          <div class="chip-grid">
            {#each mapStyles as style}
              <button class="chip" class:active={$activeStyle === style.key} onclick={() => setStyle(style.key)}>
                {style.icon} {style.label}
              </button>
            {/each}
          </div>

          <div class="section-title">Camera</div>
          <div class="slider-container">
            <span class="slider-label">Pitch</span>
            <input type="range" min="0" max="85" step="1" value={$cameraState.pitch}
              oninput={(e) => setPitch(Number(e.currentTarget.value))} />
            <span class="slider-value">{$cameraState.pitch}°</span>
          </div>
          <div class="slider-container">
            <span class="slider-label">Bearing</span>
            <input type="range" min="-180" max="180" step="1" value={$cameraState.bearing}
              oninput={(e) => setBearing(Number(e.currentTarget.value))} />
            <span class="slider-value">{$cameraState.bearing}°</span>
          </div>

          <div class="section-title">Terrain</div>
          <div class="control-row">
            <span class="control-label">3D Terrain</span>
            <label class="toggle">
              <input type="checkbox" checked={$viewSettings.terrainEnabled}
                onchange={(e) => viewSettings.update(v => ({...v, terrainEnabled: e.currentTarget.checked}))} />
              <span class="toggle-track"></span>
            </label>
          </div>
          {#if $viewSettings.terrainEnabled}
            <div class="slider-container">
              <span class="slider-label">Exaggeration</span>
              <input type="range" min="0" max="3" step="0.1" value={$viewSettings.terrainExaggeration}
                oninput={(e) => setExaggeration(Number(e.currentTarget.value))} />
              <span class="slider-value">{$viewSettings.terrainExaggeration.toFixed(1)}x</span>
            </div>
          {/if}
          <div class="control-row">
            <span class="control-label">3D Buildings</span>
            <label class="toggle">
              <input type="checkbox" checked={$viewSettings.buildings3D}
                onchange={(e) => setBuildings(e.currentTarget.checked)} />
              <span class="toggle-track"></span>
            </label>
          </div>

          <div class="section-title">Atmosphere</div>
          <div class="control-row">
            <span class="control-label">Fog</span>
            <label class="toggle">
              <input type="checkbox" checked={$viewSettings.fog}
                onchange={(e) => setFogEnabled(e.currentTarget.checked)} />
              <span class="toggle-track"></span>
            </label>
          </div>
          {#if $viewSettings.fog}
            <div class="slider-container">
              <span class="slider-label">Fog Density</span>
              <input type="range" min="0" max="1" step="0.05" value={$viewSettings.fogDensity}
                oninput={(e) => setFogDensity(Number(e.currentTarget.value))} />
              <span class="slider-value">{$viewSettings.fogDensity.toFixed(2)}</span>
            </div>
          {/if}
          <div class="control-row">
            <span class="control-label">Sky Atmosphere</span>
            <label class="toggle">
              <input type="checkbox" checked={$viewSettings.skyAtmosphere}
                onchange={(e) => setSkyAtmosphere(e.currentTarget.checked)} />
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>
      {/if}

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
          <div class="section-title">Quick Presets</div>
          <div class="preset-grid">
            {#each presets as preset}
              <button class="preset-card" onclick={() => applyPreset(preset)}>
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
        </div>
      {/if}
    </div>

    <div class="panel-footer">
      <div class="camera-readout">
        <span>{$cameraState.lat.toFixed(4)}, {$cameraState.lng.toFixed(4)}</span>
        <span>z{$cameraState.zoom}</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .panel-toggle-btn {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: var(--z-toolbar, 200);
    width: 42px;
    height: 42px;
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    color: var(--text-primary);
    font-size: 18px;
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
    top: 16px;
    left: 16px;
    bottom: 16px;
    width: 310px;
    z-index: var(--z-panel, 100);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideInLeft 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg);
    border-bottom: 1px solid var(--border-subtle);
  }
  .panel-brand {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }
  .brand-icon { font-size: 28px; }
  .brand-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }
  .brand-sub {
    font-size: 10px;
    color: var(--text-tertiary);
    font-weight: 500;
    letter-spacing: 0.03em;
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--border-subtle);
    padding: 0 var(--space-sm);
  }
  .tab-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-sm) var(--space-xs);
    border: none;
    background: none;
    color: var(--text-tertiary);
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-normal);
    border-bottom: 2px solid transparent;
  }
  .tab-btn:hover { color: var(--text-secondary); }
  .tab-btn.active {
    color: var(--text-accent);
    border-bottom-color: var(--accent-primary);
  }
  .tab-icon { font-size: 16px; }
  .tab-label { letter-spacing: 0.03em; }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg);
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
</style>
