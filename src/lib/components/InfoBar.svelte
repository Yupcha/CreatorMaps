<script lang="ts">
  import {
    cameraState, activeStyle, viewSettings, mapStyles, mapInstance,
    type MapStyleKey
  } from '$lib/stores/mapStore';
  import { get } from 'svelte/store';
  import { Mountain, Building2, Cloud, Sun, Moon, Map, Circle, Satellite, MountainSnow } from '@lucide/svelte';

  function setStyle(key: MapStyleKey) {
    activeStyle.set(key);
  }

  function setPitch(val: number) {
    cameraState.update(c => ({ ...c, pitch: val }));
    get(mapInstance)?.setPitch(val);
  }
  function setBearing(val: number) {
    cameraState.update(c => ({ ...c, bearing: val }));
    get(mapInstance)?.setBearing(val);
  }
</script>

<div class="bottom-strip">
  <div class="info-bar glass-panel" id="info-bar">
    <!-- MapLibre Scale Control -->
    <div id="maplibre-controls-container" style="display: flex; align-items: center;"></div>

    <!-- Custom Attribution -->
    <div class="custom-attrib">
      <span class="attrib-icon">i</span>
      <span class="attrib-text">© OpenFreeMap © OpenStreetMap</span>
    </div>

    <div class="info-sep">·</div>

    <!-- Style Pills -->
    <div class="style-pills">
      <button class="style-pill" class:active={$activeStyle === 'liberty'} onclick={() => setStyle('liberty')} title="Liberty"><Map size={10} /></button>
      <button class="style-pill" class:active={$activeStyle === 'bright'} onclick={() => setStyle('bright')} title="Bright"><Sun size={10} /></button>
      <button class="style-pill" class:active={$activeStyle === 'positron'} onclick={() => setStyle('positron')} title="Positron"><Circle size={10} /></button>
      <button class="style-pill" class:active={$activeStyle === 'dark'} onclick={() => setStyle('dark')} title="Dark"><Moon size={10} /></button>
      <button class="style-pill" class:active={$activeStyle === 'satellite'} onclick={() => setStyle('satellite')} title="Satellite"><Satellite size={10} /></button>
      <button class="style-pill" class:active={$activeStyle === 'terrain'} onclick={() => setStyle('terrain')} title="Terrain"><MountainSnow size={10} /></button>
    </div>

    <div class="info-sep">·</div>

    <!-- Layer Toggles -->
    <div class="toggle-row">
      <button class="layer-toggle" class:on={$viewSettings.terrainEnabled}
        onclick={() => viewSettings.update(v => ({...v, terrainEnabled: !v.terrainEnabled}))}
        title="3D Terrain"><Mountain size={10} /></button>
      <button class="layer-toggle" class:on={$viewSettings.buildings3D}
        onclick={() => viewSettings.update(v => ({...v, buildings3D: !v.buildings3D}))}
        title="3D Buildings"><Building2 size={10} /></button>
      <button class="layer-toggle" class:on={$viewSettings.fog}
        onclick={() => viewSettings.update(v => ({...v, fog: !v.fog}))}
        title="Fog"><Cloud size={10} /></button>
      <button class="layer-toggle" class:on={$viewSettings.skyAtmosphere}
        onclick={() => viewSettings.update(v => ({...v, skyAtmosphere: !v.skyAtmosphere}))}
        title="Sky Atmosphere"><Sun size={10} /></button>
    </div>

    <div class="info-sep">·</div>

    <div class="info-item">
      <span class="info-label">LAT</span>
      <span class="info-value">{$cameraState.lat.toFixed(4)}</span>
    </div>
    <div class="info-sep">·</div>
    <div class="info-item">
      <span class="info-label">LNG</span>
      <span class="info-value">{$cameraState.lng.toFixed(4)}</span>
    </div>
    <div class="info-sep">·</div>
    <div class="info-item">
      <span class="info-label">ZOOM</span>
      <span class="info-value">{$cameraState.zoom.toFixed(1)}</span>
    </div>
    <div class="info-sep">·</div>
    <div class="info-item">
      <span class="info-label">PITCH</span>
      <span class="info-value">{$cameraState.pitch}°</span>
    </div>
  </div>
</div>

<style>
  .bottom-strip {
    position: fixed;
    bottom: 4px;
    right: 12px;
    z-index: var(--z-panel, 100);
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .info-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    font-family: var(--font-mono);
    font-size: 9px;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }
  .info-item.clickable {
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 6px;
    transition: background 0.15s;
  }
  .info-item.clickable:hover {
    background: var(--bg-control-hover);
  }

  .info-label {
    color: var(--text-tertiary);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
  }
  .info-value {
    color: var(--text-secondary);
    font-weight: 500;
  }
  :global(.info-sep) {
    color: var(--text-tertiary);
    opacity: 0.3;
  }
  .style-badge {
    color: var(--text-accent);
    font-size: 9px;
    letter-spacing: 0.05em;
  }

  .custom-attrib {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-tertiary);
    cursor: pointer;
    overflow: hidden;
    max-width: 16px;
    transition: max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s;
  }
  .custom-attrib:hover {
    max-width: 250px;
    color: var(--text-secondary);
  }
  .attrib-icon {
    font-family: serif;
    font-style: italic;
    font-size: 11px;
    font-weight: bold;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 50%;
    flex-shrink: 0;
  }
  :global(.light-theme) .attrib-icon {
    border-color: rgba(0,0,0,0.2);
  }
  .attrib-text {
    font-size: 9px;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s 0.1s;
  }
  .custom-attrib:hover .attrib-text {
    opacity: 1;
  }



  /* Style Pills */
  .style-pills {
    display: flex;
    gap: 3px;
  }
  .style-pill {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 0.15s;
  }
  .style-pill:hover {
    background: var(--bg-control-hover);
    color: var(--text-secondary);
  }
  .style-pill.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    box-shadow: 0 0 6px var(--accent-primary-glow);
  }



  /* Layer Toggles */
  .toggle-row {
    display: flex;
    gap: 4px;
  }
  .layer-toggle {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 0.15s;
  }
  .layer-toggle:hover {
    background: var(--bg-control-hover);
    color: var(--text-secondary);
  }
  .layer-toggle.on {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  /* Light theme overrides */
  :global(.light-theme) .style-pill:hover {
    background: rgba(0, 0, 0, 0.05);
  }
  :global(.light-theme) .style-pill.active {
    background: rgba(99, 102, 241, 0.1);
  }
  :global(.light-theme) .layer-toggle:hover {
    background: rgba(0, 0, 0, 0.05);
  }
  :global(.light-theme) .layer-toggle.on {
    background: rgba(99, 102, 241, 0.1);
  }
  :global(.light-theme) .info-bar {
    background: rgba(255, 255, 255, 0.5);
    border-color: rgba(0, 0, 0, 0.06);
  }
</style>
