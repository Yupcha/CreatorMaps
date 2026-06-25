<script lang="ts">
  import { mapInstance, activeStyle } from '$lib/stores/mapStore';
  import { stateOverlayVisible } from '$lib/stores/indiaGeoStore';
  import { get } from 'svelte/store';
  import { Compass, Globe, Maximize, Camera, Keyboard, Sun, Moon, Route, Image } from '@lucide/svelte';
  import { tripReelOpen } from '$lib/stores/tripReelStore';
  import { posterOpen } from '$lib/stores/posterStore';

  let showShortcuts = $state(false);

  const isLightStyle = $derived(
    $activeStyle === 'liberty' || $activeStyle === 'bright' || $activeStyle === 'positron'
  );

  function toggleDarkMode() {
    if (isLightStyle) {
      activeStyle.set('dark');
    } else {
      activeStyle.set('liberty');
    }
  }

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
    link.download = `yupcha-map-${Date.now()}.png`;
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
      case 'd': toggleDarkMode(); break;
      case 't': tripReelOpen.set(true); break;
      case 'p': e.preventDefault(); posterOpen.set(true); break;
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
  <button class="btn btn-icon" onclick={() => tripReelOpen.set(true)} title="Trip Reel (T)"><Route size={16} /></button>
  <button class="btn btn-icon" onclick={() => posterOpen.set(true)} title="Poster / Wallpaper (P)"><Image size={16} /></button>
  <div class="toolbar-divider"></div>
  <button class="btn btn-icon" onclick={toggleDarkMode} title="Toggle Dark/Light (D)">
    {#if isLightStyle}
      <Moon size={16} />
    {:else}
      <Sun size={16} />
    {/if}
  </button>
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
      <kbd>T</kbd><span>Trip Reel</span>
      <kbd>P</kbd><span>Poster / Wallpaper</span>
      <kbd>Scroll</kbd><span>Zoom In/Out</span>
      <kbd>Drag</kbd><span>Pan Map</span>
      <kbd>Ctrl+Drag</kbd><span>Rotate & Pitch</span>
    </div>
  </div>
{/if}

<style>
  .toolbar {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: var(--z-toolbar, 200);
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
    border-radius: 16px;
    background: rgba(10, 10, 15, 0.78);
    backdrop-filter: blur(32px) saturate(200%);
    -webkit-backdrop-filter: blur(32px) saturate(200%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    animation: slideInRight 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toolbar-divider {
    width: 60%;
    margin: 2px auto;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }

  /* Shortcuts Modal */
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

  /* Light theme overrides */
  :global(.light-theme) .toolbar {
    background: rgba(255, 255, 255, 0.65);
    border-color: rgba(0, 0, 0, 0.08);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }
  :global(.light-theme) .toolbar-divider {
    background: rgba(0, 0, 0, 0.08);
  }

  @media (max-width: 640px) {
    .toolbar {
      top: 8px;
      right: 8px;
      flex-direction: row;
      border-radius: 12px;
      padding: 3px;
      gap: 1px;
    }
    .toolbar-divider {
      width: 1px;
      height: 16px;
      margin: 0 1px;
    }
  }
</style>
