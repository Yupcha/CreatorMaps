<script lang="ts">
  import { get } from 'svelte/store';
  import {
    Sparkles,
    Search,
    Loader2,
    X,
    MapPin,
    Eye,
    Film,
    Link2,
    Check
  } from '@lucide/svelte';
  import { mapInstance, activeStyle } from '$lib/stores/mapStore';
  import {
    rootsOpen,
    rootsScene,
    rootsRendering,
    rootsProgress,
    ROOTS_DURATIONS,
    type RootsDurationKey,
    type RootsScene
  } from '$lib/stores/rootsStore';
  import { pendingSceneFeature } from '$lib/reels';
  import {
    recordReel,
    resolveDimensions,
    drawTitleBlock,
    drawWatermark,
    drawCurtain,
    loadBrandLogo,
    ensureFontsReady,
    copyShareLink,
    decodeScene,
    type AspectKey,
    type ReelFrame
  } from '$lib/reels';
  import {
    runRootsDescent,
    resolveRootsTarget,
    type RootsTarget,
    type RootsDescentOptions
  } from '$lib/flight/rootsReel';
  import { TITLE_REVEAL_LEAD_MS } from '$lib/flight/rootsKeyframes';
  import { searchLocations, type IndianLocation } from '$lib/data/indianLocations';
  import { findCity } from '$lib/data/indianCities';
  import { getStateData } from '$lib/stores/indiaGeoStore';
  import { normalizeStateName } from '$lib/data/indiaConstants';

  // ─── Local UI state ──────────────────────────────────────────────────────
  let query = $state('');
  let results = $state<IndianLocation[]>([]);
  let nominatimResults = $state<any[]>([]);
  let searching = $state(false);
  let dropdownOpen = $state(false);
  let picked = $state<RootsScene['place'] | null>(null);
  let pickedFinal = $state<{ zoom?: number; pitch?: number; bearing?: number }>({});
  let title = $state('');
  let subtitle = $state('');
  let durationKey = $state<RootsDurationKey>('punchy');
  let aspect = $state<AspectKey>('9:16');
  let isPreviewing = $state(false);
  let previewAbort: AbortController | null = null;
  let phaseLabel = $state('');
  let shareUrl = $state('');
  let copied = $state(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  const ASPECTS: { key: AspectKey; label: string }[] = [
    { key: '9:16', label: '9:16' },
    { key: '1:1', label: '1:1' },
    { key: '16:9', label: '16:9' }
  ];

  const isRendering = $derived($rootsRendering);

  // ─── Open from a share-link (?scene= with feature 'roots') ───────────────
  $effect(() => {
    if ($pendingSceneFeature !== 'roots') return;
    // Pull the full scene back out of the URL (Foundation only hydrates shared
    // fields; our place/finalCam live in scene.params).
    if (typeof window !== 'undefined') {
      const scene = decodeScene(new URLSearchParams(window.location.search));
      const p = scene?.params as Record<string, unknown> | undefined;
      if (p && p.place && typeof p.place === 'object') {
        const place = p.place as RootsScene['place'];
        picked = place;
        query = place.name;
        title = (scene?.title as string) ?? `From ${place.name}`;
        subtitle = (scene?.subtitle as string) ?? place.state;
        pickedFinal = {
          zoom: typeof p.fz === 'number' ? p.fz : undefined,
          pitch: typeof p.fp === 'number' ? p.fp : undefined,
          bearing: typeof p.fb === 'number' ? p.fb : undefined
        };
        if (typeof p.d === 'string' && (p.d === 'punchy' || p.d === 'cinematic')) durationKey = p.d;
        if (scene?.aspect) aspect = scene.aspect;
      }
    }
    rootsOpen.set(true);
    pendingSceneFeature.set(null);
  });

  // ─── Search: instant known-place pre-fill + Nominatim fallback ───────────
  function onInput(e: Event) {
    query = (e.target as HTMLInputElement).value;
    picked = null;
    pickedFinal = {};
    if (searchTimer) clearTimeout(searchTimer);
    if (!query.trim() || query.trim().length < 2) {
      results = [];
      nominatimResults = [];
      dropdownOpen = false;
      return;
    }
    // (1) Instant local match — no network round-trip for known places.
    results = searchLocations(query);
    nominatimResults = [];
    dropdownOpen = true;
    // (2) Debounced Nominatim fallback for anything not in the curated list.
    searchTimer = setTimeout(() => runNominatim(query), 500);
  }

  async function runNominatim(q: string) {
    if (!q.trim() || q.length < 2) return;
    searching = true;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=in&format=json&limit=5&addressdetails=1`
      );
      if (res.ok) nominatimResults = await res.json();
    } catch {
      /* offline / blocked — local results still stand */
    } finally {
      searching = false;
    }
  }

  function prefillCaption(name: string, state: string) {
    // Emotional caption from state description / city famousFor.
    const stateData = getStateData(normalizeStateName(state));
    const city = findCity(name);
    title = title || `My roots — ${name}`;
    if (!subtitle) {
      subtitle = city?.famousFor?.[0] ?? stateData?.description ?? state;
    }
  }

  function selectLocation(loc: IndianLocation) {
    picked = { name: loc.name, state: loc.state || 'India', lat: loc.lat, lng: loc.lng };
    pickedFinal = { zoom: loc.zoom, pitch: loc.pitch, bearing: loc.bearing };
    query = loc.name;
    dropdownOpen = false;
    prefillCaption(loc.name, loc.state);
    quickPreview(loc.lng, loc.lat);
  }

  function selectNominatim(r: any) {
    const name = (r.display_name as string).split(',')[0];
    const state = r.address?.state ?? '';
    picked = { name, state: state || 'India', lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
    pickedFinal = {};
    query = name;
    dropdownOpen = false;
    prefillCaption(name, state);
    quickPreview(picked.lng, picked.lat);
  }

  function quickPreview(lng: number, lat: number) {
    const map = get(mapInstance);
    map?.flyTo({ center: [lng, lat], zoom: 9, pitch: 45, duration: 1400, essential: true });
  }

  // ─── Build a fully-resolved target for the descent ───────────────────────
  async function buildTarget(): Promise<RootsTarget | null> {
    if (!picked) return null;
    return resolveRootsTarget({
      name: picked.name,
      state: picked.state,
      lng: picked.lng,
      lat: picked.lat,
      finalZoom: pickedFinal.zoom,
      finalPitch: pickedFinal.pitch,
      finalBearing: pickedFinal.bearing
    });
  }

  function durationMs() {
    return ROOTS_DURATIONS[durationKey].ms;
  }

  // ─── Ensure satellite basemap is active & loaded before any flight ───────
  async function ensureSatellite(): Promise<void> {
    const map = get(mapInstance);
    if (!map) return;
    if (get(activeStyle) === 'satellite') return;
    await new Promise<void>((resolve) => {
      const onLoad = () => {
        map.off('style.load', onLoad);
        resolve();
      };
      map.on('style.load', onLoad);
      activeStyle.set('satellite');
      // Safety in case style.load already fired before the listener attached.
      setTimeout(resolve, 4000);
    });
  }

  // ─── Preview (no record) ─────────────────────────────────────────────────
  async function preview() {
    const map = get(mapInstance);
    if (!map || !picked || isPreviewing) return;
    isPreviewing = true;
    previewAbort = new AbortController();
    try {
      await ensureSatellite();
      const target = await buildTarget();
      if (!target) return;
      const opts: RootsDescentOptions = {
        totalMs: durationMs(),
        signal: previewAbort.signal,
        onPhase: (_t, label) => (phaseLabel = label)
      };
      await runRootsDescent(map, target, opts);
    } finally {
      isPreviewing = false;
      phaseLabel = '';
      previewAbort = null;
    }
  }

  function stopPreview() {
    previewAbort?.abort();
  }

  // ─── Overlay painter (composited into the captured frame) ────────────────
  function makeOverlay(target: RootsTarget, logo: HTMLImageElement | null, totalMs: number) {
    const t = title.trim() || `My roots — ${target.name}`;
    const s = subtitle.trim();
    return (ctx: CanvasRenderingContext2D, frame: ReelFrame) => {
      const { width: w, height: h, elapsedMs } = frame;
      // Brief intro fade-in from the app bg (first ~500ms).
      drawCurtain(ctx, w, h, Math.max(0, 1 - elapsedMs / 500));
      // Title fades + rises in over the final TITLE_REVEAL_LEAD_MS.
      const revealStart = totalMs - TITLE_REVEAL_LEAD_MS;
      const titleProgress =
        elapsedMs <= revealStart
          ? 0
          : Math.min(1, (elapsedMs - revealStart) / TITLE_REVEAL_LEAD_MS);
      if (titleProgress > 0) {
        drawTitleBlock(ctx, {
          title: t,
          subtitle: s || undefined,
          eyebrow: target.state !== t ? target.state : undefined,
          w,
          h,
          progress: titleProgress,
          anchor: 'bottom'
        });
      }
      // Growth-loop watermark, always on (bottom safe zone).
      drawWatermark(ctx, { w, h, brand: 'Yupcha Maps', tagline: 'made with Yupcha Maps', logo });
    };
  }

  // ─── Render + export ─────────────────────────────────────────────────────
  async function makeReel() {
    const map = get(mapInstance);
    if (!map || !picked || isRendering) return;

    rootsRendering.set(true);
    rootsProgress.set(0);
    shareUrl = '';

    try {
      await ensureFontsReady();
      const logo = await loadBrandLogo();
      await ensureSatellite();

      const target = await buildTarget();
      if (!target) return;

      const totalMs = durationMs();
      const { w, h } = resolveDimensions(aspect, 'fhd');
      const drawOverlay = makeOverlay(target, logo, totalMs);
      const safeName = target.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      await recordReel({
        map,
        width: w,
        height: h,
        durationMs: totalMs,
        // Flight must render AT the export aspect → resize the live container.
        resizeContainer: true,
        runAnimation: (signal) =>
          runRootsDescent(map, target, {
            totalMs,
            signal,
            onPhase: (_t, label) => (phaseLabel = label)
          }),
        drawOverlay,
        fileBaseName: `roots-reel-${safeName || 'home'}`,
        onProgress: (p) => rootsProgress.set(p)
      });

      // Persist the scene state for the share-link.
      rootsScene.set({
        place: picked,
        finalZoom: pickedFinal.zoom,
        finalPitch: pickedFinal.pitch,
        finalBearing: pickedFinal.bearing,
        title: title.trim(),
        subtitle: subtitle.trim(),
        durationKey,
        aspect
      });

      await offerShareLink(target);
    } catch (e) {
      console.error('Roots Reel render failed', e);
    } finally {
      rootsRendering.set(false);
      rootsProgress.set(0);
      phaseLabel = '';
    }
  }

  // ─── Share-link ────────────────────────────────────────────────────────────
  async function offerShareLink(target: RootsTarget) {
    if (!picked) return;
    shareUrl = await copyShareLink({
      feature: 'roots',
      style: 'satellite',
      aspect,
      title: title.trim(),
      subtitle: subtitle.trim(),
      cam: { lng: target.lng, lat: target.lat, zoom: target.finalZoom ?? 16.5, pitch: 70, bearing: 35 },
      params: {
        place: picked,
        fz: pickedFinal.zoom,
        fp: pickedFinal.pitch,
        fb: pickedFinal.bearing,
        d: durationKey
      }
    });
    copied = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (copied = false), 4000);
  }

  async function copyAgain() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (copied = false), 2500);
    } catch {
      /* noop */
    }
  }

  function open() {
    rootsOpen.set(true);
  }
  function close() {
    if (isRendering) return;
    stopPreview();
    rootsOpen.set(false);
  }

  const canMake = $derived(!!picked && !isRendering);
</script>

<!-- Floating launcher (hidden during any recording / rendering) -->
{#if !$rootsOpen && !isRendering}
  <button class="roots-fab" onclick={open} title="Roots Reel — space-to-rooftop zoom">
    <Sparkles size={18} />
    <span>Roots Reel</span>
  </button>
{/if}

<!-- Bottom sheet (gated on its own rendering state, like CinematicBar) -->
{#if $rootsOpen && !isRendering}
  <div class="roots-sheet glass-panel" role="dialog" aria-label="Roots Reel">
    <div class="sheet-head">
      <div class="sheet-title">
        <Sparkles size={16} />
        <span>Where are you from?</span>
      </div>
      <button class="btn-icon" onclick={close} aria-label="Close"><X size={16} /></button>
    </div>

    <!-- Search -->
    <div class="search-wrap">
      <div class="search-field">
        <Search size={15} class="search-ico" />
        <input
          type="text"
          placeholder="Your town, city, or village…"
          value={query}
          oninput={onInput}
          onfocus={() => query.length >= 2 && (dropdownOpen = true)}
        />
        {#if searching}<Loader2 size={14} class="spin" />{/if}
      </div>

      {#if dropdownOpen && (results.length > 0 || nominatimResults.length > 0)}
        <div class="dropdown">
          {#each results as loc (loc.name)}
            <button class="result" onclick={() => selectLocation(loc)}>
              <MapPin size={13} />
              <span class="r-name">{loc.name}</span>
              <span class="r-sub">{loc.state}{loc.description ? ` · ${loc.description}` : ''}</span>
            </button>
          {/each}
          {#each nominatimResults as r (r.place_id)}
            <button class="result" onclick={() => selectNominatim(r)}>
              <MapPin size={13} />
              <span class="r-name">{(r.display_name as string).split(',')[0]}</span>
              <span class="r-sub">{(r.display_name as string).split(',').slice(1, 3).join(',').trim()}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    {#if picked}
      <div class="picked">
        <MapPin size={13} />
        <strong>{picked.name}</strong>
        <span>{picked.state}</span>
      </div>

      <!-- Caption -->
      <div class="caption-block">
        <input class="cap-title" type="text" placeholder="Title (e.g. My roots — Varanasi)" bind:value={title} />
        <input class="cap-sub" type="text" placeholder="Subtitle (a line about home)" bind:value={subtitle} />
      </div>

      <!-- Duration chips -->
      <div class="chip-row">
        {#each Object.entries(ROOTS_DURATIONS) as [key, d] (key)}
          <button
            class="chip"
            class:active={durationKey === key}
            onclick={() => (durationKey = key as RootsDurationKey)}
          >
            <span class="chip-label">{d.label}</span>
            <span class="chip-sub">{d.sub}</span>
          </button>
        {/each}
      </div>

      <!-- Aspect chips -->
      <div class="chip-row aspects">
        {#each ASPECTS as a (a.key)}
          <button class="chip mini" class:active={aspect === a.key} onclick={() => (aspect = a.key)}>
            {a.label}
          </button>
        {/each}
      </div>

      <!-- Actions -->
      <div class="actions">
        {#if isPreviewing}
          <button class="btn btn-ghost" onclick={stopPreview}>
            <X size={15} /> Stop preview
          </button>
        {:else}
          <button class="btn btn-ghost" onclick={preview}>
            <Eye size={15} /> Preview
          </button>
        {/if}
        <button class="btn btn-cta" disabled={!canMake} onclick={makeReel}>
          <Film size={16} /> Make my Roots Reel
        </button>
      </div>

      {#if phaseLabel && isPreviewing}
        <div class="phase">{phaseLabel}</div>
      {/if}

      <!-- Share-link (after export) -->
      {#if shareUrl}
        <div class="share-row">
          <Link2 size={13} />
          <span class="share-text">Remix link copied — share to let anyone make theirs</span>
          <button class="btn-icon" onclick={copyAgain} aria-label="Copy link">
            {#if copied}<Check size={14} />{:else}<Link2 size={14} />{/if}
          </button>
        </div>
      {/if}
    {:else}
      <p class="hint">Type your home town and we’ll dive from space straight to it — a 9:16 reel ready to share.</p>
    {/if}
  </div>
{/if}

<!-- Full-bleed render overlay (stays visible during recording; composited
     output is separate). Container-resize jank reads as intentional. -->
{#if isRendering}
  <div class="render-overlay">
    <div class="render-card">
      <Loader2 size={28} class="spin" />
      <h3>Rendering your Roots Reel…</h3>
      {#if phaseLabel}<div class="render-phase">{phaseLabel}</div>{/if}
      <div class="progress-track">
        <div class="progress-fill" style="width:{Math.round($rootsProgress * 100)}%"></div>
      </div>
      <span class="progress-pct">{Math.round($rootsProgress * 100)}%</span>
    </div>
  </div>
{/if}

<!-- Copy toast -->
{#if copied && !isRendering}
  <div class="toast">
    <Check size={15} /> Remix link copied to clipboard
  </div>
{/if}

<style>
  /* ── Launcher FAB ── */
  .roots-fab {
    position: absolute;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: var(--radius-full, 9999px);
    border: 1px solid var(--border-medium, rgba(255, 255, 255, 0.08));
    background: linear-gradient(135deg, var(--accent-primary, #6366f1), var(--accent-secondary, #8b5cf6));
    color: #fff;
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    z-index: var(--z-toolbar, 200);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transition: transform var(--transition-spring, 400ms cubic-bezier(0.34, 1.56, 0.64, 1)), box-shadow var(--transition-normal, 200ms);
    animation: slideInUp 0.4s ease;
  }
  .roots-fab:hover {
    transform: translateX(-50%) translateY(-2px) scale(1.03);
    box-shadow: 0 12px 32px rgba(99, 102, 241, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  }

  /* ── Bottom sheet ── */
  .roots-sheet {
    position: absolute;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    width: calc(100% - 24px);
    max-width: 420px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: var(--z-panel, 100);
    animation: slideInUp 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sheet-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 15px;
    color: var(--text-primary, #fff);
  }
  .sheet-title :global(svg) {
    color: var(--accent-secondary, #8b5cf6);
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.04));
    background: var(--bg-control, rgba(255, 255, 255, 0.08));
    color: var(--text-secondary, #a1a1aa);
    cursor: pointer;
    transition: background var(--transition-fast, 120ms);
  }
  .btn-icon:hover {
    background: var(--bg-control-hover, rgba(255, 255, 255, 0.14));
    color: var(--text-primary, #fff);
  }

  /* ── Search ── */
  .search-wrap {
    position: relative;
  }
  .search-field {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: var(--radius-md, 10px);
    background: var(--bg-control, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.04));
  }
  .search-field:focus-within {
    border-color: var(--border-focus, rgba(99, 102, 241, 0.5));
  }
  .search-field :global(.search-ico) {
    color: var(--text-tertiary, #71717a);
    flex-shrink: 0;
  }
  .search-field input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text-primary, #fff);
    font-family: var(--font-sans);
    font-size: 14px;
  }
  .search-field input::placeholder {
    color: var(--text-tertiary, #71717a);
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    max-height: 240px;
    overflow-y: auto;
    background: var(--glass-bg, rgba(10, 10, 15, 0.92));
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 10px);
    z-index: var(--z-modal, 300);
    box-shadow: var(--shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.4));
  }
  .result {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas: 'ico name' 'ico sub';
    column-gap: 8px;
    align-items: center;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.04));
    cursor: pointer;
    text-align: left;
    transition: background var(--transition-fast, 120ms);
  }
  .result:hover {
    background: var(--bg-control-hover, rgba(255, 255, 255, 0.14));
  }
  .result :global(svg) {
    grid-area: ico;
    color: var(--accent-primary, #6366f1);
  }
  .r-name {
    grid-area: name;
    color: var(--text-primary, #fff);
    font-size: 13px;
    font-weight: 600;
  }
  .r-sub {
    grid-area: sub;
    color: var(--text-tertiary, #71717a);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Picked ── */
  .picked {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-secondary, #a1a1aa);
    padding: 2px 2px;
  }
  .picked :global(svg) {
    color: var(--accent-green, #10b981);
  }
  .picked strong {
    color: var(--text-primary, #fff);
  }

  /* ── Caption ── */
  .caption-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .caption-block input {
    padding: 8px 12px;
    border-radius: var(--radius-md, 10px);
    background: var(--bg-control, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.04));
    color: var(--text-primary, #fff);
    font-family: var(--font-sans);
    outline: none;
  }
  .caption-block input:focus {
    border-color: var(--border-focus, rgba(99, 102, 241, 0.5));
  }
  .cap-title {
    font-size: 14px;
    font-weight: 600;
  }
  .cap-sub {
    font-size: 12px;
  }
  .caption-block input::placeholder {
    color: var(--text-tertiary, #71717a);
  }

  /* ── Chips ── */
  .chip-row {
    display: flex;
    gap: 8px;
  }
  .chip-row.aspects {
    gap: 6px;
  }
  .chip {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px;
    border-radius: var(--radius-md, 10px);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.04));
    background: var(--bg-control, rgba(255, 255, 255, 0.08));
    color: var(--text-secondary, #a1a1aa);
    cursor: pointer;
    font-family: var(--font-sans);
    transition: all var(--transition-fast, 120ms);
  }
  .chip.mini {
    flex-direction: row;
    justify-content: center;
    font-size: 12px;
    padding: 6px;
  }
  .chip:hover {
    background: var(--bg-control-hover, rgba(255, 255, 255, 0.14));
  }
  .chip.active {
    border-color: var(--accent-primary, #6366f1);
    background: var(--accent-primary-glow, rgba(99, 102, 241, 0.18));
    color: var(--text-primary, #fff);
  }
  .chip-label {
    font-size: 13px;
    font-weight: 600;
  }
  .chip-sub {
    font-size: 10px;
    color: var(--text-tertiary, #71717a);
  }
  .chip.active .chip-sub {
    color: var(--text-accent, #c7d2fe);
  }

  /* ── Actions ── */
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 2px;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 11px 14px;
    border-radius: var(--radius-md, 10px);
    border: none;
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 600;
    transition: all var(--transition-fast, 120ms);
  }
  .btn-ghost {
    background: var(--bg-control, rgba(255, 255, 255, 0.08));
    color: var(--text-secondary, #a1a1aa);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.04));
  }
  .btn-ghost:hover {
    background: var(--bg-control-hover, rgba(255, 255, 255, 0.14));
    color: var(--text-primary, #fff);
  }
  .btn-cta {
    flex: 1;
    background: linear-gradient(135deg, var(--accent-primary, #6366f1), var(--accent-secondary, #8b5cf6));
    color: #fff;
    box-shadow: var(--shadow-glow, 0 0 20px rgba(99, 102, 241, 0.4));
  }
  .btn-cta:hover:not(:disabled) {
    transform: translateY(-1px);
  }
  .btn-cta:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .phase {
    text-align: center;
    font-size: 12px;
    color: var(--text-accent, #c7d2fe);
    font-family: var(--font-mono);
  }

  .hint {
    font-size: 12px;
    color: var(--text-tertiary, #71717a);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Share row ── */
  .share-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-md, 10px);
    background: var(--accent-primary-glow, rgba(99, 102, 241, 0.18));
    border: 1px solid var(--border-focus, rgba(99, 102, 241, 0.5));
  }
  .share-row :global(svg) {
    color: var(--accent-secondary, #8b5cf6);
    flex-shrink: 0;
  }
  .share-text {
    flex: 1;
    font-size: 12px;
    color: var(--text-primary, #fff);
  }

  /* ── Render overlay ── */
  .render-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-toast, 400);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 15, 0.55);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    pointer-events: none;
  }
  .render-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 28px 36px;
    border-radius: var(--radius-xl, 20px);
    background: var(--glass-bg, rgba(10, 10, 15, 0.78));
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
    box-shadow: var(--shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.4));
  }
  .render-card :global(svg) {
    color: var(--accent-secondary, #8b5cf6);
  }
  .render-card h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary, #fff);
  }
  .render-phase {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-accent, #c7d2fe);
  }
  .progress-track {
    width: 220px;
    height: 6px;
    border-radius: var(--radius-full, 9999px);
    background: var(--bg-control, rgba(255, 255, 255, 0.08));
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--accent-primary, #6366f1), var(--accent-secondary, #8b5cf6));
    transition: width 0.2s ease;
  }
  .progress-pct {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-secondary, #a1a1aa);
  }

  /* ── Toast ── */
  .toast {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: var(--radius-full, 9999px);
    background: var(--accent-green, #10b981);
    color: #04201a;
    font-weight: 600;
    font-size: 13px;
    z-index: var(--z-toast, 400);
    box-shadow: var(--shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.4));
    animation: slideInUp 0.3s ease;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  /* ── Light theme overrides ── */
  :global(.light-theme) .roots-sheet,
  :global(.light-theme) .dropdown,
  :global(.light-theme) .render-card {
    background: rgba(255, 255, 255, 0.92);
    border-color: rgba(0, 0, 0, 0.08);
  }
  :global(.light-theme) .sheet-title,
  :global(.light-theme) .r-name,
  :global(.light-theme) .picked strong,
  :global(.light-theme) .caption-block input,
  :global(.light-theme) .render-card h3 {
    color: #18181b;
  }
  :global(.light-theme) .search-field,
  :global(.light-theme) .caption-block input,
  :global(.light-theme) .chip,
  :global(.light-theme) .btn-ghost {
    background: rgba(0, 0, 0, 0.04);
    border-color: rgba(0, 0, 0, 0.08);
  }
  :global(.light-theme) .search-field input,
  :global(.light-theme) .search-field input::placeholder {
    color: #18181b;
  }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .roots-sheet {
      max-width: none;
      width: calc(100% - 16px);
      bottom: 12px;
    }
    .roots-fab {
      bottom: 14px;
    }
  }
</style>
