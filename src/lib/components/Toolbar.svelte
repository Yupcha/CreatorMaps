<script lang="ts">
  import { mapInstance } from '$lib/stores/mapStore';
  import { stateOverlayVisible } from '$lib/stores/indiaGeoStore';
  import { get } from 'svelte/store';
  import { Compass, Globe, Maximize, Camera, Keyboard } from '@lucide/svelte';

  let showShortcuts = $state(false);

  function resetNorth() {
    get(mapInstance)?.flyTo({ bearing: 0, pitch: 0, duration: 1000 });
  }

  function zoomToIndia() {
    get(mapInstance)?.flyTo({
      center: [78.9629, 22.0],
      zoom: 4.5,
      pitch: 0,
      bearing: 0,
      duration: 2000,
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  function quickScreenshot() {
    const map = get(mapInstance);
    if (!map) return;
    const canvas = map.getCanvas();
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `india-map-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    switch (e.key.toLowerCase()) {
      case 'n': resetNorth(); break;
      case 'i': zoomToIndia(); break;
      case 'b': stateOverlayVisible.update(v => !v); break;
      case 'f': toggleFullscreen(); break;
      case 's': quickScreenshot(); break;
      case '?': showShortcuts = !showShortcuts; break;
    }
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="toolbar glass-panel" id="toolbar">
  <button class="btn btn-icon" onclick={resetNorth} title="Reset North (N)"><Compass size={16} /></button>
  <button class="btn btn-icon" onclick={zoomToIndia} title="Zoom to India (I)"><Globe size={16} /></button>
  <button class="btn btn-icon" onclick={toggleFullscreen} title="Fullscreen (F)"><Maximize size={16} /></button>
  <div class="toolbar-divider"></div>
  <button class="btn btn-icon btn-accent" onclick={quickScreenshot} title="Quick Screenshot (S)"><Camera size={16} /></button>
  <div class="toolbar-divider"></div>
  <button class="btn btn-icon" onclick={() => (showShortcuts = !showShortcuts)} title="Shortcuts (?)"><Keyboard size={16} /></button>
</div>

{#if showShortcuts}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="shortcuts-modal glass-panel" onclick={() => (showShortcuts = false)}>
    <h3>Keyboard Shortcuts</h3>
    <div class="shortcut-grid">
      <kbd>N</kbd><span>Reset North</span>
      <kbd>I</kbd><span>Zoom to India</span>
      <kbd>B</kbd><span>Toggle Boundaries</span>
      <kbd>F</kbd><span>Toggle Fullscreen</span>
      <kbd>S</kbd><span>Quick Screenshot</span>
      <kbd>Scroll</kbd><span>Zoom In/Out</span>
      <kbd>Drag</kbd><span>Pan Map</span>
      <kbd>Ctrl+Drag</kbd><span>Rotate & Pitch</span>
    </div>
  </div>
{/if}

<style>
  .toolbar {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: var(--z-toolbar, 200);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-sm);
    animation: slideInRight 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toolbar-divider {
    width: 100%;
    height: 1px;
    background: var(--border-subtle);
    margin: 2px 0;
  }

  .shortcuts-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: var(--z-modal, 300);
    padding: var(--space-xl) var(--space-2xl);
    min-width: 280px;
    animation: fadeIn 200ms ease;
    cursor: pointer;
  }

  .shortcuts-modal h3 {
    font-size: 14px;
    font-weight: 700;
    margin-bottom: var(--space-lg);
    color: var(--text-primary);
  }

  .shortcut-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-sm) var(--space-lg);
    align-items: center;
  }

  .shortcut-grid kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background: var(--bg-control);
    border: 1px solid var(--border-medium);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-accent);
    min-width: 28px;
  }

  .shortcut-grid span {
    font-size: 12px;
    color: var(--text-secondary);
  }
</style>
