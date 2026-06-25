<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import {
    mapInstance,
    cameraState,
    activeStyle,
    visualFilters,
    presets,
    type MapPreset
  } from '$lib/stores/mapStore';
  import { selectedStateName } from '$lib/stores/indiaGeoStore';
  import {
    posterOpen,
    posterAspect,
    posterTitle,
    posterSubtitle,
    posterStatLine,
    showWatermark,
    showQR,
    cleanMap,
    posterDpr,
    posterSvg,
    posterBusy,
    dprReducedNote,
    closePoster
  } from '$lib/stores/posterStore';
  import {
    POSTER_PRESETS,
    POSTER_ASPECT_ORDER,
    aspectRatio,
    type PosterAspectKey
  } from '$lib/poster/posterPresets';
  import { trackExport, trackEvent } from '$lib/utils/analytics';

  // Foundation scene-link (single source of truth — do not reinvent).
  import { encodeScene, buildShareUrl, copyShareLink } from '$lib/reels';

  // ─── Local UI state ─────────────────────────────────────────
  let previewCanvasEl = $state<HTMLCanvasElement | null>(null);
  let previewWrapEl = $state<HTMLElement | null>(null);
  let toast = $state<string>('');
  let composing = $state(false);
  let previewToken = 0;

  const aspect = $derived($posterAspect);
  const preset = $derived(POSTER_PRESETS[aspect]);
  const ratio = $derived(aspectRatio(aspect));

  // Effective output pixel size (informational note in the UI).
  let pxNote = $state('');

  // ─── Lifecycle ──────────────────────────────────────────────
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function showToast(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), 2600);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !$posterBusy) {
      e.preventDefault();
      closePoster();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', onKeydown);
    schedulePreview();
  });
  onDestroy(() => {
    window.removeEventListener('keydown', onKeydown);
    clearTimeout(toastTimer);
  });

  // Re-render the low-res preview whenever config changes.
  $effect(() => {
    // Track deps.
    void aspect;
    void $posterTitle;
    void $posterSubtitle;
    void $posterStatLine;
    void $showWatermark;
    void $cleanMap;
    void $activeStyle;
    schedulePreview();
  });

  function schedulePreview() {
    const token = ++previewToken;
    // Slight delay so map settles after a Compose Shot / style change.
    requestAnimationFrame(() => {
      if (token === previewToken) void renderPreview(token);
    });
  }

  // ─── Preview (small dpr, reuses live canvas) ────────────────
  async function renderPreview(token: number) {
    const map = get(mapInstance);
    if (!map || !previewCanvasEl) return;
    composing = true;
    try {
      const { composePoster } = await import('$lib/poster/composePoster');
      const src = map.getCanvas();
      // Compose at a small dpr for a fast, light preview.
      const previewDpr = Math.min(
        0.45,
        Math.max(0.2, 540 / Math.max(preset.w, preset.h))
      );
      const { dataUrl } = await composePoster({
        mapCanvas: src,
        aspect,
        dpr: previewDpr,
        title: $posterTitle,
        subtitle: $posterSubtitle,
        statLine: $posterStatLine,
        showWatermark: $showWatermark,
        showClean: $cleanMap,
        shareUrl: undefined,
        qrCanvas: null
      });
      if (token !== previewToken || !previewCanvasEl) return;
      const img = new Image();
      img.onload = () => {
        if (token !== previewToken || !previewCanvasEl) return;
        const c = previewCanvasEl;
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = dataUrl;
    } catch (e) {
      console.error('[PosterStudio] preview failed', e);
    } finally {
      composing = false;
    }
  }

  // ─── Preset look chips ──────────────────────────────────────
  function applyLook(p: MapPreset) {
    const map = get(mapInstance);
    activeStyle.set(p.style);
    visualFilters.set({ ...p.filters });
    if (map) {
      map.easeTo({
        center: [p.lng, p.lat],
        zoom: p.zoom,
        pitch: p.pitch,
        bearing: p.bearing,
        duration: 1400,
        easing: (t) => 1 - Math.pow(1 - t, 3)
      });
      cameraState.set({
        lng: p.lng,
        lat: p.lat,
        zoom: p.zoom,
        pitch: p.pitch,
        bearing: p.bearing
      });
      map.once('moveend', () => schedulePreview());
    }
    showToast(`Look · ${p.name}`);
  }

  // ─── Compose Shot (cinematic framing on the LIVE map only) ──
  function composeShot() {
    const map = get(mapInstance);
    if (!map) return;
    const portrait = aspect === '9:16' || aspect === '4:5' || aspect === 'print-a4';
    // Rule of thirds: lower the subject so the title block has the top third.
    const pitchPreset = portrait ? 62 : 35;
    const bearing = map.getBearing() || -15;
    map.easeTo({
      pitch: pitchPreset,
      bearing,
      duration: 2600,
      easing: (t) => 1 - Math.pow(1 - t, 3)
    });
    map.once('moveend', () => {
      const h = map.getCanvas().clientHeight;
      map.panBy([0, h * 0.18], { duration: 600 });
      map.once('moveend', () => {
        const c = map.getCenter();
        cameraState.set({
          lng: c.lng,
          lat: c.lat,
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing()
        });
        schedulePreview();
      });
    });
    showToast('Composed shot');
  }

  // ─── Build the shareable scene for this poster ──────────────
  function currentScene() {
    const cam = get(cameraState);
    return {
      feature: 'poster' as const,
      cam: { lng: cam.lng, lat: cam.lat, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing },
      style: get(activeStyle),
      title: $posterTitle,
      subtitle: $posterSubtitle,
      params: {
        aspect,
        statLine: $posterStatLine,
        filters: { ...get(visualFilters) },
        selectedState: get(selectedStateName),
        watermark: $showWatermark,
        qr: $showQR,
        clean: $cleanMap
      }
    };
  }

  // ─── Export pipeline ────────────────────────────────────────
  async function doExport() {
    if ($posterBusy) return; // single in-flight guard
    const map = get(mapInstance);
    if (!map) {
      showToast('Map not ready');
      return;
    }
    posterBusy.set(true);
    dprReducedNote.set('');
    try {
      // Lazy-load the heavy modules ONLY inside the export handler.
      const [{ renderPosterCanvas }, { composePoster }, { makeQrCanvas }] = await Promise.all([
        import('$lib/poster/renderMap'),
        import('$lib/poster/composePoster'),
        import('$lib/poster/qr')
      ]);

      const scene = currentScene();
      const shareUrl = buildShareUrl(scene);
      const enc = encodeScene(scene);

      // 1. Render the map at the requested size (reuse-live or offscreen).
      const rendered = await renderPosterCanvas({
        width: preset.w,
        height: preset.h,
        dpr: $posterDpr
      });
      if (rendered.clamp.reduced) {
        dprReducedNote.set(
          `Down-rezzed to ${rendered.clamp.dpr.toFixed(2)}× (${rendered.clamp.pxW}×${rendered.clamp.pxH}) to stay within limits.`
        );
      }
      pxNote = `${rendered.clamp.pxW} × ${rendered.clamp.pxH}px`;

      // 2. QR for the corner (only if enabled and not clean mode).
      let qrCanvas: HTMLCanvasElement | null = null;
      if ($showQR && !$cleanMap) {
        try {
          qrCanvas = makeQrCanvas(shareUrl, Math.round(150 * rendered.clamp.dpr));
        } catch (e) {
          console.warn('[PosterStudio] QR generation failed', e);
        }
      }

      // 3. Composite into the final PNG.
      const { pngBlob, dataUrl } = await composePoster({
        mapCanvas: rendered.canvas,
        aspect,
        dpr: rendered.clamp.dpr,
        title: $posterTitle,
        subtitle: $posterSubtitle,
        statLine: $posterStatLine,
        showWatermark: $showWatermark,
        showClean: $cleanMap,
        shareUrl,
        qrCanvas
      });

      const baseName = `yupcha-poster-${aspect.replace(':', 'x')}`;
      const pngFile = new File([pngBlob], `${baseName}.png`, { type: 'image/png' });

      // 4. Bake the remixable link into the URL + clipboard (best-effort).
      try {
        history.replaceState(null, '', `?scene=${enc}`);
      } catch {
        /* ignore */
      }
      let linkCopied = false;
      try {
        await copyShareLink(scene);
        linkCopied = true;
      } catch {
        /* clipboard blocked */
      }

      // 5. Share-first: navigator.share → clipboard image → download.
      const method = await deliver(pngFile, pngBlob, baseName);

      trackExport(`poster_${aspect}`);
      trackEvent('poster_shared', { method, aspect, dpr: rendered.clamp.dpr });

      // 6. Optional SVG (print-quality, raster map + vector text).
      if ($posterSvg) {
        const { buildPosterSvg } = await import('$lib/poster/buildPosterSvg');
        const svgBlob = buildPosterSvg({
          mapPngDataUrl: dataUrl,
          aspect,
          layout: {
            title: $posterTitle,
            subtitle: $posterSubtitle,
            statLine: $posterStatLine,
            showWatermark: $showWatermark,
            showClean: $cleanMap,
            shareUrl: $showQR && !$cleanMap ? shareUrl : undefined
          }
        });
        downloadBlob(svgBlob, `${baseName}.svg`);
        trackEvent('poster_svg_exported', { aspect });
      }

      showToast(
        linkCopied
          ? `Poster exported · share link copied${method === 'download' ? ' · downloaded' : ''}`
          : 'Poster exported'
      );
    } catch (e) {
      console.error('[PosterStudio] export failed', e);
      showToast('Export failed — see console');
    } finally {
      posterBusy.set(false);
    }
  }

  /** Share-first delivery: navigator.share(files) → clipboard → download. */
  async function deliver(
    file: File,
    blob: Blob,
    baseName: string
  ): Promise<'share' | 'clipboard' | 'download'> {
    // navigator.share with files (mobile).
    const navAny = navigator as any;
    if (navAny.canShare && navAny.canShare({ files: [file] })) {
      try {
        await navAny.share({ files: [file], title: 'Yupcha Maps poster' });
        return 'share';
      } catch {
        /* user cancelled or unsupported — fall through */
      }
    }
    // Clipboard image (desktop).
    try {
      if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        // Still download too so the user keeps a file.
        downloadBlob(blob, `${baseName}.png`);
        return 'clipboard';
      }
    } catch {
      /* clipboard image blocked — fall through */
    }
    downloadBlob(blob, `${baseName}.png`);
    return 'download';
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyLinkOnly() {
    try {
      const url = await copyShareLink(currentScene());
      showToast('Share link copied');
      return url;
    } catch {
      showToast('Could not copy link');
    }
  }
</script>

<div class="poster-backdrop" role="presentation" onclick={() => { if (!$posterBusy) closePoster(); }}>
  <div
    class="poster-modal glass-panel"
    role="dialog"
    aria-modal="true"
    aria-label="Poster and wallpaper studio"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Header -->
    <header class="ps-header">
      <div class="ps-title">
        <span class="ps-icon">🖼️</span>
        <div>
          <h2>Poster Studio</h2>
          <p>Hi-res wallpaper &amp; print export</p>
        </div>
      </div>
      <button class="btn-icon" aria-label="Close" onclick={() => closePoster()} disabled={$posterBusy}>✕</button>
    </header>

    <div class="ps-body">
      <!-- Preview with safe-frame guide -->
      <div class="ps-preview-col">
        <div
          class="ps-preview"
          bind:this={previewWrapEl}
          style={`aspect-ratio:${ratio};`}
        >
          <canvas bind:this={previewCanvasEl} class="ps-preview-canvas"></canvas>
          <div class="ps-safeframe" aria-hidden="true">
            <span class="ps-sf ps-sf-tl"></span>
            <span class="ps-sf ps-sf-tr"></span>
            <span class="ps-sf ps-sf-bl"></span>
            <span class="ps-sf ps-sf-br"></span>
          </div>
          {#if composing}
            <div class="ps-preview-busy" aria-hidden="true"><span class="spinner"></span></div>
          {/if}
        </div>
        <div class="ps-px-note">{preset.label} · {preset.w}×{preset.h} @ {$posterDpr}×{pxNote ? ` → ${pxNote}` : ''}</div>
        {#if $dprReducedNote}
          <div class="ps-warn">⚠ {$dprReducedNote}</div>
        {/if}
      </div>

      <!-- Controls -->
      <div class="ps-controls">
        <!-- Aspect -->
        <div class="section">
          <div class="section-title">Format</div>
          <div class="aspect-grid">
            {#each POSTER_ASPECT_ORDER as key (key)}
              <button
                class="aspect-chip"
                class:active={aspect === key}
                onclick={() => posterAspect.set(key as PosterAspectKey)}
                title={POSTER_PRESETS[key].hint}
              >
                <span class="ac-shape ac-{key.replace(':', 'x')}"></span>
                <span class="ac-label">{POSTER_PRESETS[key].label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Look presets -->
        <div class="section">
          <div class="section-title">Gallery looks</div>
          <div class="look-grid">
            {#each presets as p (p.name)}
              <button class="look-chip" onclick={() => applyLook(p)} title={p.description}>
                <span class="look-icon">{p.icon}</span>
                <span class="look-name">{p.name}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Text -->
        <div class="section">
          <div class="section-title">Title block</div>
          <input class="ps-input" placeholder="Title" bind:value={$posterTitle} maxlength="48" />
          <input class="ps-input" placeholder="Subtitle" bind:value={$posterSubtitle} maxlength="64" />
          <input class="ps-input mono" placeholder="Stat line" bind:value={$posterStatLine} maxlength="80" />
        </div>

        <!-- Toggles + dpr -->
        <div class="section">
          <div class="section-title">Output</div>
          <label class="ps-row">
            <span>Watermark</span>
            <input type="checkbox" bind:checked={$showWatermark} />
          </label>
          <label class="ps-row">
            <span>QR remix link</span>
            <input type="checkbox" bind:checked={$showQR} />
          </label>
          <label class="ps-row">
            <span>Clean (map only)</span>
            <input type="checkbox" bind:checked={$cleanMap} />
          </label>
          <label class="ps-row">
            <span>Also export SVG <small>(print: raster map + vector text)</small></span>
            <input type="checkbox" bind:checked={$posterSvg} />
          </label>
          <div class="ps-row slider-row">
            <span>Resolution</span>
            <div class="dpr-pills">
              {#each [1, 2, 3] as d (d)}
                <button class="dpr-pill" class:active={$posterDpr === d} onclick={() => posterDpr.set(d)}>{d}×</button>
              {/each}
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="ps-actions">
          <button class="btn" onclick={composeShot} disabled={$posterBusy}>🎬 Compose Shot</button>
          <button class="btn" onclick={copyLinkOnly} disabled={$posterBusy}>🔗 Copy link</button>
          <button class="btn btn-accent ps-export" onclick={doExport} disabled={$posterBusy}>
            {#if $posterBusy}<span class="spinner"></span> Exporting…{:else}⬇ Export Poster{/if}
          </button>
        </div>
      </div>
    </div>

    {#if toast}
      <div class="ps-toast" role="status">{toast}</div>
    {/if}
  </div>
</div>

<style>
  .poster-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    background: rgba(5, 5, 9, 0.72);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
    animation: fadeIn var(--transition-normal);
  }

  .poster-modal {
    width: min(960px, 96vw);
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideInUp var(--transition-spring);
  }

  .ps-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg);
    border-bottom: 1px solid var(--border-subtle);
  }
  .ps-title {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }
  .ps-icon {
    font-size: 28px;
  }
  .ps-title h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  .ps-title p {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-tertiary);
  }

  .ps-body {
    display: grid;
    grid-template-columns: minmax(220px, 360px) 1fr;
    gap: var(--space-lg);
    padding: var(--space-lg);
    overflow: auto;
  }

  /* Preview */
  .ps-preview-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .ps-preview {
    position: relative;
    width: 100%;
    max-height: 62vh;
    margin: 0 auto;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--bg-secondary);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-medium);
  }
  .ps-preview-canvas {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .ps-safeframe {
    position: absolute;
    inset: 6%;
    pointer-events: none;
  }
  .ps-sf {
    position: absolute;
    width: 22px;
    height: 22px;
    border: 2px solid var(--accent-primary);
    opacity: 0.85;
  }
  .ps-sf-tl { top: 0; left: 0; border-right: 0; border-bottom: 0; }
  .ps-sf-tr { top: 0; right: 0; border-left: 0; border-bottom: 0; }
  .ps-sf-bl { bottom: 0; left: 0; border-right: 0; border-top: 0; }
  .ps-sf-br { bottom: 0; right: 0; border-left: 0; border-top: 0; }

  .ps-preview-busy {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 15, 0.25);
  }

  .ps-px-note {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-tertiary);
    text-align: center;
  }
  .ps-warn {
    font-size: 0.74rem;
    color: var(--accent-warm);
    text-align: center;
  }

  /* Controls */
  .ps-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    min-width: 0;
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .section-title {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }

  .aspect-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--space-xs);
  }
  .aspect-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) 4px;
    background: var(--bg-control);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .aspect-chip:hover { background: var(--bg-control-hover); }
  .aspect-chip.active {
    border-color: var(--border-focus);
    background: var(--bg-control-active);
    color: var(--text-primary);
    box-shadow: var(--shadow-glow);
  }
  .ac-shape {
    display: block;
    border: 2px solid currentColor;
    border-radius: 2px;
    opacity: 0.85;
  }
  .ac-9x16 { width: 13px; height: 22px; }
  .ac-1x1 { width: 20px; height: 20px; }
  .ac-16x9 { width: 24px; height: 14px; }
  .ac-4x5 { width: 17px; height: 21px; }
  .ac-print-a4 { width: 15px; height: 22px; border-style: dashed; }
  .ac-label {
    font-size: 0.6rem;
    line-height: 1.1;
    text-align: center;
  }

  .look-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-xs);
  }
  .look-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: var(--space-sm) 4px;
    background: var(--bg-control);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .look-chip:hover {
    background: var(--bg-control-hover);
    color: var(--text-primary);
  }
  .look-icon { font-size: 18px; }
  .look-name { font-size: 0.62rem; text-align: center; line-height: 1.1; }

  .ps-input {
    width: 100%;
    padding: 8px 10px;
    background: var(--bg-control);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 0.85rem;
  }
  .ps-input.mono { font-family: var(--font-mono); font-size: 0.78rem; }
  .ps-input:focus {
    outline: none;
    border-color: var(--border-focus);
  }

  .ps-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    font-size: 0.82rem;
    color: var(--text-secondary);
  }
  .ps-row small { color: var(--text-tertiary); font-size: 0.68rem; }
  .ps-row input[type='checkbox'] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-primary);
    cursor: pointer;
  }
  .dpr-pills { display: flex; gap: 4px; }
  .dpr-pill {
    padding: 4px 10px;
    background: var(--bg-control);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-full);
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    cursor: pointer;
  }
  .dpr-pill.active {
    border-color: var(--border-focus);
    background: var(--bg-control-active);
    color: var(--text-primary);
  }

  .ps-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    margin-top: auto;
    padding-top: var(--space-sm);
  }
  .ps-actions .btn { flex: 1 1 auto; }
  .ps-export { flex: 2 1 200px; }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    vertical-align: middle;
  }

  .ps-toast {
    position: absolute;
    bottom: var(--space-lg);
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-full);
    color: var(--text-primary);
    font-size: 0.8rem;
    box-shadow: var(--shadow-lg);
    animation: slideInUp var(--transition-normal);
    z-index: var(--z-toast);
  }

  /* Light theme overrides */
  :global(.light-theme) .poster-backdrop {
    background: rgba(240, 240, 248, 0.7);
  }
  :global(.light-theme) .ps-input,
  :global(.light-theme) .aspect-chip,
  :global(.light-theme) .look-chip,
  :global(.light-theme) .dpr-pill {
    color: #1a1a2e;
  }
  :global(.light-theme) .ps-title h2 {
    color: #0a0a0f;
  }

  /* Mobile: stack to a bottom-sheet-ish single column */
  @media (max-width: 720px) {
    .poster-modal {
      width: 100vw;
      max-height: 96vh;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    }
    .ps-body {
      grid-template-columns: 1fr;
    }
    .ps-preview {
      max-height: 38vh;
    }
    .aspect-grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }
</style>
