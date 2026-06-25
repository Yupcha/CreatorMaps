<script lang="ts">
  /**
   * Data Reel feature UI + live in-app preview.
   *
   * - One-tap "Make a Data Reel" presets everything (population, 9:16, 15s,
   *   dark style, watermark, punchy auto-title) → recordable in ≤2 taps.
   * - Live preview leaderboard uses @number-flow/svelte (DOM — NOT captured),
   *   driven by sampleReel() on a local rAF clock. Same easing as export, so
   *   on-screen ≈ file.
   * - Preview runs the on-map reveal (no record); Record calls the engine's
   *   recordDataReel (offscreen 2D compositor → downloadable video / PNG).
   * - Reel state is reel-LOCAL (reelStore), never mutates global overlayMetric.
   */
  import { get } from 'svelte/store';
  import { onDestroy } from 'svelte';
  import NumberFlow from '@number-flow/svelte';
  import { Film, Play, Square, Download, Share2, Check } from '@lucide/svelte';

  import { mapInstance, activeStyle, panelOpen } from '$lib/stores/mapStore';
  import { METRIC_CONFIGS, type OverlayMetric } from '$lib/data/indiaConstants';
  import {
    reelMetric,
    reelDurationKey,
    reelBpm,
    reelTopN,
    reelBearingDrift,
    isReelPlaying,
    REEL_DURATIONS,
    durationPreset,
    type ReelDurationKey
  } from '$lib/stores/reelStore';
  import {
    reelAspect,
    reelResolution,
    reelWatermark,
    reelTitle,
    ensureFontsReady,
    loadBrandLogo,
    resolveDimensions,
    buildShareUrl,
    shareScene,
    copyShareLink,
    type AspectKey
  } from '$lib/reels';
  import {
    buildTimeline,
    playReel,
    clearReveal,
    recordDataReel
  } from '$lib/reel/dataReelEngine';
  import { sampleReel, type ReelViewModel, type ReelTimeline } from '$lib/reel/dataReelTimeline';
  import { formatMetric } from '$lib/reel/metricFormat';
  import { titleFor, subtitleFor } from '$lib/reel/titlePresets';

  const METRICS: OverlayMetric[] = ['population', 'gdpBillionUsd', 'literacy', 'area'];
  const ASPECTS: AspectKey[] = ['9:16', '1:1', '16:9'];

  let titleEdited = $state(false);
  let isExpanded = $state(false);
  let isRecording = $state(false);
  let recordProgress = $state(0);
  let toast = $state<string | null>(null);
  let copied = $state(false);

  // Live preview clock state
  let previewVM = $state<ReelViewModel | null>(null);
  let abortCtrl: AbortController | null = null;
  let previewTimeline: ReelTimeline | null = null;

  const cfg = $derived(METRIC_CONFIGS[$reelMetric]);

  // keep auto-title fresh until the user edits it
  $effect(() => {
    const m = $reelMetric;
    if (!titleEdited) reelTitle.set(titleFor(m));
  });

  // keep bpm + topN sane for the chosen duration
  function applyDuration(key: ReelDurationKey) {
    reelDurationKey.set(key);
    const p = durationPreset(key);
    reelBpm.set(p.bpm);
    reelTopN.update((n) => Math.min(n, p.maxTopN));
  }

  function makeTimeline(): ReelTimeline {
    const p = durationPreset(get(reelDurationKey));
    return buildTimeline({
      metric: get(reelMetric),
      topN: get(reelTopN),
      durationMs: p.ms,
      bpm: get(reelBpm),
      beatsPerState: p.beatsPerState
    });
  }

  // One-tap: presets everything for an instant punchy reel
  function makeDataReel() {
    reelMetric.set('population');
    reelAspect.set('9:16');
    applyDuration('normal');
    reelWatermark.set(true);
    titleEdited = false;
    reelTitle.set(titleFor('population'));
    activeStyle.set('dark');
    isExpanded = true;
  }

  function showToast(msg: string, ms = 3200) {
    toast = msg;
    setTimeout(() => (toast = null), ms);
  }

  async function startPreview() {
    const map = get(mapInstance);
    if (!map || $isReelPlaying) return;
    isReelPlaying.set(true);
    abortCtrl = new AbortController();
    const timeline = makeTimeline();
    previewTimeline = timeline;
    previewVM = sampleReel(timeline, 0);
    try {
      await playReel({
        map,
        timeline,
        drift: get(reelBearingDrift),
        signal: abortCtrl.signal,
        onTick: (vm) => {
          previewVM = vm;
        }
      });
    } finally {
      isReelPlaying.set(false);
      clearReveal(map);
      previewVM = null;
      previewTimeline = null;
    }
  }

  function stopPreview() {
    abortCtrl?.abort();
  }

  async function record() {
    const map = get(mapInstance);
    if (!map || isRecording) return;
    isRecording = true;
    recordProgress = 0;
    abortCtrl = new AbortController();
    try {
      await ensureFontsReady();
      const logo = await loadBrandLogo();
      const { w, h } = resolveDimensions(get(reelAspect), get(reelResolution));
      const timeline = makeTimeline();
      const metric = get(reelMetric);
      const shareUrl = buildShareUrl(currentScene());
      const result = await recordDataReel({
        map,
        timeline,
        width: w,
        height: h,
        drift: get(reelBearingDrift),
        fileBaseName: `yupcha-data-reel-${metric}`,
        signal: abortCtrl.signal,
        onProgress: (p) => (recordProgress = p),
        overlay: {
          metric,
          title: get(reelTitle),
          subtitle: subtitleFor(metric),
          watermark: get(reelWatermark),
          logo,
          shareUrl,
          topN: get(reelTopN)
        }
      });
      // persist remixable link in the URL bar
      await shareScene(currentScene());
      if (result.kind === 'png') {
        showToast('Your browser can’t record video — saved a hi-res still instead.');
      } else {
        showToast('Reel saved! Reveals are beat-timed — add your own audio on IG/Reels.');
      }
    } catch (err) {
      console.error('[DataReel] record failed', err);
      showToast('Recording failed. Try again.');
    } finally {
      isRecording = false;
      recordProgress = 0;
    }
  }

  function currentScene() {
    return {
      feature: 'data' as const,
      style: get(activeStyle),
      aspect: get(reelAspect),
      title: get(reelTitle),
      subtitle: subtitleFor(get(reelMetric)),
      params: {
        metric: get(reelMetric),
        durationKey: get(reelDurationKey),
        bpm: get(reelBpm),
        topN: get(reelTopN),
        watermark: get(reelWatermark),
        drift: get(reelBearingDrift)
      }
    };
  }

  async function copyLink() {
    await copyShareLink(currentScene());
    copied = true;
    setTimeout(() => (copied = false), 1800);
  }

  onDestroy(() => {
    abortCtrl?.abort();
    const map = get(mapInstance);
    if (map) clearReveal(map);
  });

  // preview rows for the static (non-playing) leaderboard so the panel always
  // shows the final board as a "what you'll get" hint.
  const staticVM = $derived.by<ReelViewModel>(() => {
    const t = buildTimeline({
      metric: $reelMetric,
      topN: $reelTopN,
      durationMs: durationPreset($reelDurationKey).ms,
      bpm: $reelBpm,
      beatsPerState: durationPreset($reelDurationKey).beatsPerState
    });
    return sampleReel(t, t.durationMs); // fully settled board
  });

  const liveVM = $derived(previewVM ?? staticVM);
</script>

<div class="reel-panel">
  <!-- One-tap CTA -->
  <button class="cta" onclick={makeDataReel} disabled={isRecording}>
    <Film size={16} />
    <span>Make a Data Reel</span>
  </button>
  <p class="hint">Top-N states reveal, scored to a beat. 9:16 vertical by default.</p>

  {#if isExpanded}
    <div class="config" style="animation: slideInUp 300ms cubic-bezier(.34,1.56,.64,1)">
      <!-- Metric -->
      <div class="section-title">Metric</div>
      <div class="chip-grid">
        {#each METRICS as m}
          <button
            class="chip"
            class:active={$reelMetric === m}
            onclick={() => reelMetric.set(m)}
          >
            <span class="chip-icon">{METRIC_CONFIGS[m].icon}</span>
            {METRIC_CONFIGS[m].label}
          </button>
        {/each}
      </div>

      <!-- Orientation -->
      <div class="section-title">Orientation</div>
      <div class="chip-row">
        {#each ASPECTS as a}
          <button class="chip" class:active={$reelAspect === a} onclick={() => reelAspect.set(a)}>
            {a}
          </button>
        {/each}
      </div>

      <!-- Duration -->
      <div class="section-title">Duration</div>
      <div class="chip-row">
        {#each REEL_DURATIONS as d}
          <button
            class="chip"
            class:active={$reelDurationKey === d.key}
            onclick={() => applyDuration(d.key)}
          >
            {d.label}
          </button>
        {/each}
      </div>

      <!-- Top N -->
      <div class="control-row">
        <span class="control-label">Top {$reelTopN}</span>
        <input
          type="range"
          min="3"
          max={durationPreset($reelDurationKey).maxTopN}
          step="1"
          value={$reelTopN}
          oninput={(e) => reelTopN.set(+(e.currentTarget as HTMLInputElement).value)}
        />
      </div>

      <!-- BPM -->
      <div class="control-row">
        <span class="control-label">Beat · {$reelBpm} BPM</span>
        <input
          type="range"
          min="80"
          max="140"
          step="1"
          value={$reelBpm}
          oninput={(e) => reelBpm.set(+(e.currentTarget as HTMLInputElement).value)}
        />
      </div>

      <!-- Title -->
      <div class="section-title">Title</div>
      <input
        class="title-input"
        type="text"
        value={$reelTitle}
        oninput={(e) => {
          titleEdited = true;
          reelTitle.set((e.currentTarget as HTMLInputElement).value);
        }}
        placeholder={titleFor($reelMetric)}
      />

      <!-- Toggles -->
      <div class="toggle-row">
        <span class="control-label">Watermark</span>
        <button
          class="toggle"
          class:on={$reelWatermark}
          onclick={() => reelWatermark.update((v) => !v)}
          aria-label="Toggle watermark"
        >
          <span class="toggle-track"><span class="toggle-knob"></span></span>
        </button>
      </div>
      <div class="toggle-row">
        <span class="control-label">Slow bearing drift</span>
        <button
          class="toggle"
          class:on={$reelBearingDrift}
          onclick={() => reelBearingDrift.update((v) => !v)}
          aria-label="Toggle bearing drift"
        >
          <span class="toggle-track"><span class="toggle-knob"></span></span>
        </button>
      </div>

      <!-- Live preview leaderboard (DOM, not captured — mirrors export) -->
      <div class="section-title">Preview</div>
      <div class="leaderboard">
        {#each liveVM.rows.slice(0, 6) as row (row.normalizedName)}
          <div class="lb-row" style:opacity={Math.max(0.2, row.settle)}>
            <span class="lb-rank" class:gold={row.rank === 1}>{row.rank}</span>
            <span class="lb-name">{row.state.name}</span>
            <span class="lb-value">
              {#if $reelMetric === 'population'}
                <NumberFlow value={Math.round(row.counter)} locales="en-IN" />
              {:else if $reelMetric === 'gdpBillionUsd'}
                $<NumberFlow value={Math.round(row.counter)} />B
              {:else if $reelMetric === 'literacy'}
                <NumberFlow value={row.counter} format={{ maximumFractionDigits: 1 }} />%
              {:else}
                <NumberFlow value={Math.round(row.counter)} locales="en-IN" /> km²
              {/if}
            </span>
            <span class="lb-bar">
              <span
                class="lb-bar-fill"
                style:width="{row.barWidth}%"
                style:background="linear-gradient(90deg, {cfg.colors[0]}, {cfg.colors[1]}, {cfg.colors[2]})"
              ></span>
            </span>
          </div>
        {/each}
        {#if liveVM.rows.length === 0}
          <div class="lb-empty">Press Preview to play the reveal on the map.</div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="actions">
        {#if $isReelPlaying}
          <button class="btn" onclick={stopPreview}><Square size={14} /> Stop</button>
        {:else}
          <button class="btn" onclick={startPreview} disabled={isRecording}>
            <Play size={14} /> Preview
          </button>
        {/if}
        <button class="btn btn-accent" onclick={record} disabled={isRecording || $isReelPlaying}>
          {#if isRecording}
            <span class="rec-dot"></span> {Math.round(recordProgress * 100)}%
          {:else}
            <Download size={14} /> Record
          {/if}
        </button>
      </div>

      <button class="share-link" onclick={copyLink}>
        {#if copied}<Check size={13} /> Link copied!{:else}<Share2 size={13} /> Copy share link{/if}
      </button>
    </div>
  {/if}

  {#if toast}
    <div class="toast">{toast}</div>
  {/if}
</div>

<style>
  .reel-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-xs) 0;
  }

  .cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 11px 14px;
    border: none;
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.01em;
    cursor: pointer;
    box-shadow: var(--shadow-glow);
    transition: transform var(--transition-fast), filter var(--transition-fast);
  }
  .cta:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.08);
  }
  .cta:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .hint {
    margin: 0;
    font-size: 10px;
    line-height: 1.4;
    color: var(--text-tertiary);
    text-align: center;
  }

  .config {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin-top: 4px;
  }

  .chip-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .chip-row {
    display: flex;
    gap: 6px;
  }
  .chip {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 7px 8px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--bg-control);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }
  .chip:hover {
    background: var(--bg-control-hover, rgba(255, 255, 255, 0.14));
    color: var(--text-primary);
  }
  .chip.active {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: #fff;
  }
  .chip-icon {
    font-size: 12px;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .control-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    min-width: 92px;
    white-space: nowrap;
  }
  .control-row input[type='range'] {
    flex: 1;
  }

  .title-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--bg-control);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-sans);
  }
  .title-input:focus {
    outline: none;
    border-color: var(--border-focus);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .toggle {
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
  }
  .toggle-track {
    display: block;
    width: 36px;
    height: 20px;
    border-radius: var(--radius-full);
    background: var(--bg-control);
    position: relative;
    transition: background var(--transition-fast);
  }
  .toggle.on .toggle-track {
    background: var(--accent-primary);
  }
  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    transition: transform var(--transition-spring);
  }
  .toggle.on .toggle-knob {
    transform: translateX(16px);
  }

  .leaderboard {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-subtle);
  }
  .lb-row {
    display: grid;
    grid-template-columns: 18px 1fr auto;
    grid-template-areas: 'rank name value' 'rank bar bar';
    align-items: center;
    gap: 2px 8px;
    transition: opacity var(--transition-smooth);
  }
  .lb-rank {
    grid-area: rank;
    font-size: 11px;
    font-weight: 800;
    color: var(--text-tertiary);
    text-align: center;
    font-family: var(--font-mono);
  }
  .lb-rank.gold {
    color: var(--accent-green);
  }
  .lb-name {
    grid-area: name;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lb-value {
    grid-area: value;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }
  .lb-bar {
    grid-area: bar;
    height: 3px;
    border-radius: 2px;
    background: var(--bg-control);
    overflow: hidden;
  }
  .lb-bar-fill {
    display: block;
    height: 100%;
    border-radius: 2px;
  }
  .lb-empty {
    font-size: 10px;
    color: var(--text-tertiary);
    text-align: center;
    padding: 6px 0;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--bg-control);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .btn:hover:not(:disabled) {
    background: var(--bg-control-hover, rgba(255, 255, 255, 0.14));
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .btn-accent {
    background: var(--accent-green);
    border-color: var(--accent-green);
    color: #04140d;
  }
  .btn-accent:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .rec-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-red);
    animation: pulse 1s ease-in-out infinite;
  }

  .share-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 7px;
    border: 1px dashed var(--border-medium);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .share-link:hover {
    color: var(--text-primary);
    border-color: var(--border-focus);
  }

  .toast {
    margin-top: 6px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: var(--text-primary);
    font-size: 11px;
    line-height: 1.4;
    text-align: center;
    animation: slideInUp 240ms ease;
  }

  /* light-theme overrides (map style liberty/bright/positron) */
  :global(.light-theme) .hint,
  :global(.light-theme) .section-title {
    color: #6b7280;
  }
  :global(.light-theme) .chip {
    background: rgba(0, 0, 0, 0.05);
    color: #374151;
    border-color: rgba(0, 0, 0, 0.08);
  }
  :global(.light-theme) .chip.active {
    color: #fff;
  }
  :global(.light-theme) .lb-name,
  :global(.light-theme) .lb-value,
  :global(.light-theme) .btn {
    color: #111827;
  }
  :global(.light-theme) .leaderboard {
    background: rgba(0, 0, 0, 0.04);
  }
  :global(.light-theme) .title-input {
    background: rgba(0, 0, 0, 0.05);
    color: #111827;
  }
</style>
