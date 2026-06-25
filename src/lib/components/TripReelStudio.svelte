<script lang="ts">
  import {
    MapPin,
    Search,
    Loader2,
    X,
    Plus,
    Trash2,
    Eye,
    Video,
    Link2,
    Check,
    Route,
    Music,
    StopCircle
  } from '@lucide/svelte';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import { mapInstance } from '$lib/stores/mapStore';
  import {
    tripReelOpen,
    tripStops,
    tripDurationKey,
    tripAspect,
    tripMusic,
    tripTitle,
    isRecording,
    isPreviewing,
    TRIP_DURATIONS,
    TRIP_MUSIC,
    type TripDurationKey
  } from '$lib/stores/tripReelStore';
  import { searchLocations, type IndianLocation } from '$lib/data/indianLocations';
  import { findCity } from '$lib/data/indianCities';
  import type { TripStop } from '$lib/flight/tripRoute';
  import { runFlight, type FlightWaypoint } from '$lib/flight/engine';
  import { buildTripTimeline } from '$lib/flight/tripChoreography';
  import { makeTripOverlay, tripSceneParams } from '$lib/flight/tripReel';
  import {
    recordReel,
    resolveDimensions,
    ensureFontsReady,
    loadBrandLogo,
    copyShareLink,
    reelProgress,
    type AspectKey
  } from '$lib/reels';

  // ── Trip Ideas (reskinned routeTemplates) ──
  interface TripIdea {
    name: string;
    desc: string;
    emoji: string;
    stops: { name: string; state: string; lng: number; lat: number }[];
  }
  const tripIdeas: TripIdea[] = [
    {
      name: 'Golden Triangle',
      desc: 'Delhi → Agra → Jaipur',
      emoji: '🛕',
      stops: [
        { name: 'Delhi', state: 'Delhi', lng: 77.209, lat: 28.6139 },
        { name: 'Agra', state: 'Uttar Pradesh', lng: 78.0081, lat: 27.1767 },
        { name: 'Jaipur', state: 'Rajasthan', lng: 75.7873, lat: 26.9124 }
      ]
    },
    {
      name: 'Coastal Run',
      desc: 'Mumbai → Goa → Kochi',
      emoji: '🌊',
      stops: [
        { name: 'Mumbai', state: 'Maharashtra', lng: 72.8777, lat: 19.076 },
        { name: 'Goa', state: 'Goa', lng: 73.8278, lat: 15.2993 },
        { name: 'Kochi', state: 'Kerala', lng: 76.2673, lat: 9.9312 }
      ]
    },
    {
      name: 'Himalayan Trail',
      desc: 'Shimla → Manali → Leh',
      emoji: '🏔️',
      stops: [
        { name: 'Shimla', state: 'Himachal Pradesh', lng: 77.1734, lat: 31.1048 },
        { name: 'Manali', state: 'Himachal Pradesh', lng: 77.1892, lat: 32.2396 },
        { name: 'Leh', state: 'Ladakh', lng: 77.577, lat: 34.1526 }
      ]
    },
    {
      name: 'North → South',
      desc: 'Srinagar → Kanyakumari',
      emoji: '🧭',
      stops: [
        { name: 'Srinagar', state: 'Jammu & Kashmir', lng: 74.7973, lat: 34.0837 },
        { name: 'Kanyakumari', state: 'Tamil Nadu', lng: 77.5385, lat: 8.0883 }
      ]
    },
    {
      name: 'Spiritual Heart',
      desc: 'Varanasi → Bodh Gaya → Rishikesh',
      emoji: '🕉️',
      stops: [
        { name: 'Varanasi', state: 'Uttar Pradesh', lng: 83.0007, lat: 25.3176 },
        { name: 'Patna', state: 'Bihar', lng: 85.1376, lat: 25.6093 },
        { name: 'Rishikesh', state: 'Uttarakhand', lng: 78.2676, lat: 30.0869 }
      ]
    }
  ];

  // ── itinerary search state ──
  let query = $state('');
  let results = $state<{ name: string; state: string; lng: number; lat: number; desc?: string }[]>([]);
  let searching = $state(false);
  let searchOpen = $state(false);
  let searchInput = $state<HTMLInputElement | null>(null);
  let searchDebounce: ReturnType<typeof setTimeout> | undefined;

  // status / share
  let aborter: AbortController | null = null;
  let copied = $state(false);
  let statusMsg = $state('');

  const stops = $derived($tripStops);
  const canRun = $derived(stops.length >= 2);
  const busy = $derived($isRecording || $isPreviewing);

  const aspects: { key: AspectKey; label: string; ratio: string }[] = [
    { key: '9:16', label: 'Reel', ratio: '9:16' },
    { key: '1:1', label: 'Square', ratio: '1:1' },
    { key: '16:9', label: 'Wide', ratio: '16:9' }
  ];

  onMount(() => {
    // focus the itinerary input shortly after open
    setTimeout(() => searchInput?.focus(), 120);
  });

  // refocus whenever the sheet opens
  $effect(() => {
    if ($tripReelOpen) setTimeout(() => searchInput?.focus(), 120);
  });

  function close() {
    if (busy) return;
    tripReelOpen.set(false);
  }

  // ── search: local camera-tuned locations first, Nominatim fallback ──
  function onInput(e: Event) {
    query = (e.target as HTMLInputElement).value;
    clearTimeout(searchDebounce);
    if (query.trim().length < 2) {
      results = [];
      searchOpen = false;
      return;
    }
    searchOpen = true;
    searchDebounce = setTimeout(runSearch, 350);
  }

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    searching = true;
    // 1) local curated locations
    const local: IndianLocation[] = searchLocations(q);
    let merged = local.map((l) => ({ name: l.name, state: l.state, lng: l.lng, lat: l.lat, desc: l.description }));
    // 2) Nominatim fallback if few local hits
    if (merged.length < 5) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=in&format=json&limit=5&addressdetails=1`
        );
        if (res.ok) {
          const data = await res.json();
          for (const r of data) {
            const name = String(r.display_name).split(',')[0].trim();
            const state = r.address?.state ?? '';
            if (merged.some((m) => m.name.toLowerCase() === name.toLowerCase())) continue;
            merged.push({ name, state, lng: parseFloat(r.lon), lat: parseFloat(r.lat), desc: undefined });
          }
        }
      } catch {
        /* offline / rate-limited — local results still show */
      }
    }
    // dedupe by name
    const seen = new Set<string>();
    results = merged.filter((m) => {
      const k = m.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    searching = false;
  }

  function addStop(r: { name: string; state: string; lng: number; lat: number }) {
    const next: TripStop = { name: r.name, state: r.state, lng: r.lng, lat: r.lat };
    tripStops.update((s) => [...s, next]);
    query = '';
    results = [];
    searchOpen = false;
    searchInput?.focus();
    const map = get(mapInstance);
    map?.flyTo({ center: [r.lng, r.lat], zoom: 9, pitch: 45, duration: 1200, essential: true });
  }

  function removeStop(i: number) {
    tripStops.update((s) => s.filter((_, idx) => idx !== i));
  }

  function moveStop(i: number, dir: -1 | 1) {
    tripStops.update((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function loadIdea(idea: TripIdea) {
    tripStops.set(idea.stops.map((s) => ({ ...s })));
    const map = get(mapInstance);
    const first = idea.stops[0];
    map?.flyTo({ center: [first.lng, first.lat], zoom: 6, pitch: 35, duration: 1500, essential: true });
  }

  function subtitleFor(s: TripStop): string {
    const c = findCity(s.name);
    return c?.famousFor?.[0] ?? s.state ?? '';
  }

  function durationMs(): number {
    return TRIP_DURATIONS.find((d) => d.key === $tripDurationKey)!.ms;
  }

  function waypoints(): FlightWaypoint[] {
    return stops.map((s) => ({ name: s.name, state: s.state, lng: s.lng, lat: s.lat }));
  }

  // ── Preview (no recording) ──
  async function preview() {
    const map = get(mapInstance);
    if (!map || !canRun || busy) return;
    isPreviewing.set(true);
    statusMsg = '';
    aborter = new AbortController();
    try {
      await runFlight(map, waypoints(), {
        style: 'triproute',
        totalMs: durationMs(),
        signal: aborter.signal
      });
    } finally {
      isPreviewing.set(false);
      aborter = null;
    }
  }

  // ── Generate Reel (record + export) ──
  async function generate() {
    const map = get(mapInstance);
    if (!map || !canRun || busy) return;
    isRecording.set(true);
    statusMsg = 'Preparing…';
    reelProgress.set(0);
    aborter = new AbortController();

    const total = durationMs();
    const { w, h } = resolveDimensions($tripAspect, 'fhd');

    // Build the shared timeline so stamps stay in sync with the camera clock.
    const tripStopsArr: TripStop[] = stops.map((s) => ({ ...s }));
    const timeline = buildTripTimeline(tripStopsArr, total);

    await ensureFontsReady();
    const logo = await loadBrandLogo();
    const overlay = makeTripOverlay({
      timeline,
      title: $tripTitle.trim() || undefined,
      watermark: true,
      logo,
      aspect: $tripAspect
    });

    try {
      statusMsg = 'Recording…';
      const result = await recordReel({
        map,
        width: w,
        height: h,
        durationMs: total,
        resizeContainer: true, // flight must render AT the export aspect
        drawOverlay: overlay,
        fileBaseName: `yupcha-trip-${$tripAspect.replace(':', 'x')}-${Date.now()}`,
        signal: aborter.signal,
        runAnimation: (signal) =>
          runFlight(map, waypoints(), {
            style: 'triproute',
            totalMs: total,
            signal,
            tripTimeline: timeline
          })
      });
      statusMsg = result.aborted
        ? 'Stopped.'
        : result.kind === 'png'
          ? 'Saved a still (video not supported here).'
          : 'Reel downloaded!';
    } catch (err) {
      console.error('Trip reel export failed', err);
      statusMsg = 'Export failed.';
    } finally {
      isRecording.set(false);
      reelProgress.set(0);
      aborter = null;
    }
  }

  function stop() {
    aborter?.abort();
  }

  async function copyLink() {
    if (!canRun) return;
    await copyShareLink({
      feature: 'trip',
      aspect: $tripAspect,
      title: $tripTitle.trim() || undefined,
      params: tripSceneParams(stops, $tripDurationKey, $tripMusic)
    });
    copied = true;
    setTimeout(() => (copied = false), 1800);
  }
</script>

{#if $tripReelOpen}
  <div class="trip-reel-sheet glass-panel" role="dialog" aria-label="Trip Reel Studio">
    <!-- header -->
    <div class="trip-reel-head">
      <div class="trip-reel-title">
        <Route size={16} />
        <span>Trip Reel</span>
      </div>
      <button class="trip-reel-close" onclick={close} disabled={busy} title="Close">
        <X size={16} />
      </button>
    </div>

    <!-- itinerary search -->
    <div class="trip-reel-search">
      <Search size={15} class="trip-reel-search-icon" />
      <input
        bind:this={searchInput}
        type="text"
        placeholder="Add a place to your trip…"
        value={query}
        oninput={onInput}
        onfocus={() => { if (query.trim().length >= 2) searchOpen = true; }}
      />
      {#if searching}
        <Loader2 size={14} class="trip-reel-spin" />
      {/if}

      {#if searchOpen && (results.length > 0 || searching)}
        <div class="trip-reel-dropdown">
          {#if results.length === 0 && searching}
            <div class="trip-reel-empty">Searching…</div>
          {/if}
          {#each results as r}
            <button class="trip-reel-result" onclick={() => addStop(r)}>
              <MapPin size={14} />
              <div class="trip-reel-result-text">
                <span class="rr-main">{r.name}</span>
                <span class="rr-sub">{r.state || r.desc || 'India'}</span>
              </div>
              <Plus size={14} class="rr-add" />
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- itinerary list -->
    {#if stops.length > 0}
      <div class="trip-reel-stops">
        {#each stops as s, i (s.name + i)}
          <div class="trip-stop-chip">
            <span class="trip-stop-idx">{i + 1}</span>
            <div class="trip-stop-text">
              <span class="trip-stop-name">{s.name}</span>
              <span class="trip-stop-sub">{subtitleFor(s)}</span>
            </div>
            <div class="trip-stop-actions">
              <button class="trip-stop-mini" disabled={i === 0} onclick={() => moveStop(i, -1)} title="Move up">↑</button>
              <button class="trip-stop-mini" disabled={i === stops.length - 1} onclick={() => moveStop(i, 1)} title="Move down">↓</button>
              <button class="trip-stop-mini danger" onclick={() => removeStop(i)} title="Remove">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Trip Ideas -->
      <div class="trip-reel-section">
        <span class="trip-reel-label">Trip Ideas</span>
        <div class="trip-idea-grid">
          {#each tripIdeas as idea}
            <button class="trip-idea" onclick={() => loadIdea(idea)} title={idea.desc}>
              <span class="trip-idea-emoji">{idea.emoji}</span>
              <span class="trip-idea-name">{idea.name}</span>
              <span class="trip-idea-desc">{idea.desc}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- title input -->
    <div class="trip-reel-section">
      <span class="trip-reel-label">Title (optional)</span>
      <input
        class="trip-reel-title-input"
        type="text"
        placeholder="My India Journey"
        value={$tripTitle}
        oninput={(e) => tripTitle.set((e.target as HTMLInputElement).value)}
      />
    </div>

    <!-- aspect + duration -->
    <div class="trip-reel-row">
      <div class="trip-reel-col">
        <span class="trip-reel-label">Format</span>
        <div class="trip-reel-pills">
          {#each aspects as a}
            <button class="trip-pill" class:active={$tripAspect === a.key} onclick={() => tripAspect.set(a.key)}>
              <span class="trip-pill-main">{a.ratio}</span>
              <span class="trip-pill-sub">{a.label}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="trip-reel-row">
      <div class="trip-reel-col">
        <span class="trip-reel-label">Length</span>
        <div class="trip-reel-pills">
          {#each TRIP_DURATIONS as d}
            <button
              class="trip-pill"
              class:active={$tripDurationKey === d.key}
              onclick={() => tripDurationKey.set(d.key as TripDurationKey)}
            >
              <span class="trip-pill-main">{d.sub}</span>
              <span class="trip-pill-sub">{d.label}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- music -->
    <div class="trip-reel-section">
      <span class="trip-reel-label"><Music size={10} style="vertical-align:-1px" /> Music</span>
      <div class="trip-music-row">
        {#each TRIP_MUSIC as m}
          <button class="trip-music-pill" class:active={$tripMusic === m.id} onclick={() => tripMusic.set(m.id)}>
            {m.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- progress -->
    {#if $isRecording}
      <div class="trip-reel-progress">
        <div class="trip-reel-progress-bar" style="width: {Math.round($reelProgress * 100)}%"></div>
      </div>
    {/if}
    {#if statusMsg}
      <div class="trip-reel-status">{statusMsg}</div>
    {/if}

    <!-- actions -->
    <div class="trip-reel-actions">
      <button class="trip-btn ghost" onclick={copyLink} disabled={!canRun || busy} title="Copy a remixable share link">
        {#if copied}<Check size={14} /> Copied{:else}<Link2 size={14} /> Remix link{/if}
      </button>
      <div class="trip-reel-spacer"></div>
      {#if busy}
        <button class="trip-btn stop" onclick={stop}>
          <StopCircle size={14} /> Stop
        </button>
      {:else}
        <button class="trip-btn ghost" onclick={preview} disabled={!canRun}>
          <Eye size={14} /> Preview
        </button>
        <button class="trip-btn primary" onclick={generate} disabled={!canRun}>
          <Video size={14} /> Generate Reel
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .trip-reel-sheet {
    position: absolute;
    top: 50%;
    right: 16px;
    transform: translateY(-50%);
    width: 360px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    padding: 14px;
    z-index: var(--z-modal, 300);
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: slideInUp var(--transition-spring, 400ms cubic-bezier(0.34, 1.56, 0.64, 1));
  }

  .trip-reel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .trip-reel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--text-primary);
  }
  .trip-reel-title :global(svg) {
    color: var(--accent-green, #10b981);
  }
  .trip-reel-close {
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-sm, 6px);
    display: flex;
  }
  .trip-reel-close:hover {
    background: var(--bg-control, rgba(255, 255, 255, 0.08));
    color: var(--text-primary);
  }

  /* search */
  .trip-reel-search {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-control, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
    border-radius: var(--radius-md, 10px);
    padding: 8px 10px;
  }
  .trip-reel-search :global(.trip-reel-search-icon) {
    color: var(--text-tertiary);
    flex-shrink: 0;
  }
  .trip-reel-search :global(.trip-reel-spin) {
    color: var(--text-secondary);
    animation: spin 1s linear infinite;
    flex-shrink: 0;
  }
  .trip-reel-search input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    min-width: 0;
  }
  .trip-reel-search input::placeholder {
    color: var(--text-tertiary);
  }
  .trip-reel-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    background: var(--glass-bg, rgba(10, 10, 15, 0.92));
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 10px);
    overflow: hidden;
    z-index: 20;
    box-shadow: var(--shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.4));
    max-height: 240px;
    overflow-y: auto;
  }
  .trip-reel-result {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
    cursor: pointer;
    text-align: left;
    color: var(--text-secondary);
  }
  .trip-reel-result:hover {
    background: var(--bg-control-hover, rgba(255, 255, 255, 0.14));
  }
  .trip-reel-result :global(.rr-add) {
    margin-left: auto;
    color: var(--accent-green, #10b981);
  }
  .trip-reel-result-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .rr-main {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .rr-sub {
    font-size: 11px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .trip-reel-empty {
    padding: 12px;
    font-size: 12px;
    color: var(--text-tertiary);
    text-align: center;
  }

  /* stops */
  .trip-reel-stops {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .trip-stop-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-control, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
    border-radius: var(--radius-md, 10px);
    padding: 7px 9px;
  }
  .trip-stop-idx {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-green, #10b981);
    color: #06150f;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.35);
  }
  .trip-stop-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex: 1;
  }
  .trip-stop-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .trip-stop-sub {
    font-size: 11px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .trip-stop-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .trip-stop-mini {
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-sm, 6px);
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .trip-stop-mini:hover:not(:disabled) {
    background: var(--bg-control-hover, rgba(255, 255, 255, 0.14));
    color: var(--text-primary);
  }
  .trip-stop-mini:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .trip-stop-mini.danger:hover {
    background: rgba(239, 68, 68, 0.15);
    color: var(--accent-red, #ef4444);
  }

  /* sections */
  .trip-reel-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .trip-reel-row {
    display: flex;
    gap: 10px;
  }
  .trip-reel-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .trip-reel-label {
    font-size: 9px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .trip-idea-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .trip-idea {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: 9px 10px;
    border-radius: var(--radius-md, 10px);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
    background: var(--bg-control, rgba(255, 255, 255, 0.05));
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast, 120ms);
  }
  .trip-idea:hover {
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.08);
  }
  .trip-idea-emoji {
    font-size: 16px;
  }
  .trip-idea-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .trip-idea-desc {
    font-size: 10px;
    color: var(--text-tertiary);
  }

  .trip-reel-title-input {
    width: 100%;
    background: var(--bg-control, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
    border-radius: var(--radius-md, 10px);
    padding: 8px 10px;
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
  }
  .trip-reel-title-input:focus {
    border-color: var(--border-focus, rgba(99, 102, 241, 0.5));
  }
  .trip-reel-title-input::placeholder {
    color: var(--text-tertiary);
  }

  /* pills */
  .trip-reel-pills {
    display: flex;
    gap: 6px;
  }
  .trip-pill {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 7px 4px;
    border-radius: var(--radius-md, 10px);
    border: 1px solid transparent;
    background: var(--bg-control, rgba(255, 255, 255, 0.05));
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all var(--transition-fast, 120ms);
  }
  .trip-pill-main {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-secondary);
  }
  .trip-pill-sub {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .trip-pill:hover {
    background: var(--bg-control-hover, rgba(255, 255, 255, 0.12));
  }
  .trip-pill.active {
    background: rgba(16, 185, 129, 0.14);
    border-color: var(--accent-green, #10b981);
  }
  .trip-pill.active .trip-pill-main {
    color: var(--accent-green, #34d399);
  }
  .trip-pill.active .trip-pill-sub {
    color: var(--accent-green, #34d399);
  }

  .trip-music-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .trip-music-pill {
    padding: 5px 10px;
    border-radius: var(--radius-full, 9999px);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--bg-control, rgba(255, 255, 255, 0.04));
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast, 120ms);
  }
  .trip-music-pill:hover {
    background: var(--bg-control-hover, rgba(255, 255, 255, 0.12));
  }
  .trip-music-pill.active {
    background: rgba(99, 102, 241, 0.16);
    border-color: var(--accent-primary, #6366f1);
    color: var(--text-accent, #c7d2fe);
  }

  /* progress + status */
  .trip-reel-progress {
    height: 4px;
    border-radius: var(--radius-full, 9999px);
    background: var(--bg-control, rgba(255, 255, 255, 0.08));
    overflow: hidden;
  }
  .trip-reel-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #34d399);
    transition: width 0.2s linear;
  }
  .trip-reel-status {
    font-size: 11px;
    color: var(--text-secondary);
    text-align: center;
  }

  /* actions */
  .trip-reel-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  }
  .trip-reel-spacer {
    flex: 1;
  }
  .trip-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: var(--radius-md, 10px);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all var(--transition-fast, 120ms);
  }
  .trip-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .trip-btn.ghost {
    background: var(--bg-control, rgba(255, 255, 255, 0.06));
    color: var(--text-secondary);
  }
  .trip-btn.ghost:hover:not(:disabled) {
    background: var(--bg-control-hover, rgba(255, 255, 255, 0.14));
    color: var(--text-primary);
  }
  .trip-btn.primary {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
  }
  .trip-btn.primary:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .trip-btn.stop {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #fff;
  }

  @keyframes spin {
    100% {
      transform: rotate(360deg);
    }
  }

  /* light theme */
  :global(.light-theme) .trip-reel-sheet {
    background: rgba(255, 255, 255, 0.75);
    border-color: rgba(0, 0, 0, 0.08);
  }
  :global(.light-theme) .trip-reel-dropdown {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(0, 0, 0, 0.1);
  }
  :global(.light-theme) .trip-reel-result {
    border-bottom-color: rgba(0, 0, 0, 0.06);
  }
  :global(.light-theme) .trip-reel-result:hover,
  :global(.light-theme) .trip-stop-mini:hover:not(:disabled),
  :global(.light-theme) .trip-music-pill:hover,
  :global(.light-theme) .trip-pill:hover,
  :global(.light-theme) .trip-btn.ghost:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.05);
  }

  /* mobile bottom sheet */
  @media (max-width: 640px) {
    .trip-reel-sheet {
      top: auto;
      bottom: 0;
      right: 0;
      left: 0;
      transform: none;
      width: 100%;
      max-width: 100%;
      max-height: 80vh;
      border-radius: var(--radius-xl, 20px) var(--radius-xl, 20px) 0 0;
    }
    .trip-idea-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
