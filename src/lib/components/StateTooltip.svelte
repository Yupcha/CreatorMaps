<script lang="ts">
  import {
    hoveredStateName, hoveredMousePos, selectedStateName,
    overlayMetric, getStateData,
  } from '$lib/stores/indiaGeoStore';
  import { METRIC_CONFIGS } from '$lib/data/indiaConstants';
  import { Users, Ruler, BookOpen, MapPin, BarChart3 } from '@lucide/svelte';

  const stateData = $derived.by(() => {
    const name = $hoveredStateName;
    if (!name) return null;
    return getStateData(name) ?? null;
  });

  const metricConfig = $derived(METRIC_CONFIGS[$overlayMetric]);

  const metricValue = $derived.by(() => {
    if (!stateData) return null;
    return stateData[$overlayMetric] as number;
  });

  const metricFormatted = $derived.by(() => {
    if (metricValue === null || metricValue === undefined) return '—';
    return metricConfig.format(metricValue);
  });

  // Metric bar fill percentage for the mini spark bar
  const barPercent = $derived.by(() => {
    if (metricValue === null || metricValue === undefined) return 0;
    return Math.max(2, Math.min(100,
      ((metricValue - metricConfig.min) / (metricConfig.max - metricConfig.min)) * 100
    ));
  });

  const isSelected = $derived($selectedStateName === $hoveredStateName);

  // Tooltip position with viewport boundary clamping
  const tooltipStyle = $derived.by(() => {
    const pos = $hoveredMousePos;
    if (!pos) return 'display:none;';
    const offsetX = 16;
    const offsetY = -10;
    let x = pos.x + offsetX;
    let y = pos.y + offsetY;
    // Clamp to prevent overflow (tooltip is ~260px wide, ~160px tall)
    if (x + 270 > window.innerWidth) x = pos.x - 280;
    if (y + 180 > window.innerHeight) y = pos.y - 190;
    if (y < 10) y = 10;
    return `left:${x}px; top:${y}px;`;
  });
</script>

{#if stateData && $hoveredMousePos}
  <div class="state-tooltip" style={tooltipStyle}>
    <div class="tt-header">
      <div class="tt-name-group">
        <span class="tt-name">{stateData.name}</span>
        {#if isSelected}
          <span class="tt-selected-badge">SELECTED</span>
        {/if}
      </div>
      <span class="tt-capital">{stateData.capital}</span>
    </div>
    <div class="tt-divider"></div>
    <div class="tt-metric-row">
      <span class="tt-metric-icon"><BarChart3 size={13} /></span>
      <span class="tt-metric-label">{metricConfig.label}</span>
      <span class="tt-metric-value">{metricFormatted}</span>
    </div>
    <div class="tt-bar-track">
      <div
        class="tt-bar-fill"
        style:width="{barPercent}%"
        style:background="linear-gradient(90deg, {metricConfig.colors[0]}, {metricConfig.colors[1]}, {metricConfig.colors[2]})"
      ></div>
    </div>
    <div class="tt-stats">
      <span class="tt-stat"><Users size={10} /> {stateData.population >= 1e7 ? `${(stateData.population / 1e7).toFixed(1)} Cr` : stateData.population.toLocaleString('en-IN')}</span>
      <span class="tt-stat"><Ruler size={10} /> {stateData.area.toLocaleString('en-IN')} km²</span>
      <span class="tt-stat"><BookOpen size={10} /> {stateData.literacy}%</span>
    </div>
    <div class="tt-hint">Click to focus</div>
  </div>
{/if}

<style>
  .state-tooltip {
    position: fixed;
    z-index: 500;
    min-width: 240px;
    max-width: 280px;
    padding: 14px 16px;
    background: rgba(8, 8, 18, 0.92);
    backdrop-filter: blur(24px) saturate(1.8);
    -webkit-backdrop-filter: blur(24px) saturate(1.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset,
      0 1px 0 rgba(255, 255, 255, 0.08) inset;
    pointer-events: none;
    animation: tooltipIn 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: transform, opacity;
  }

  @keyframes tooltipIn {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .tt-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tt-name-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tt-name {
    font-size: 15px;
    font-weight: 700;
    color: #f1f1f4;
    letter-spacing: -0.01em;
  }

  .tt-selected-badge {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #6366f1;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .tt-capital {
    font-size: 11px;
    color: #a5b4fc;
    font-weight: 500;
  }

  .tt-divider {
    height: 1px;
    margin: 8px 0;
    background: linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
  }

  .tt-metric-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .tt-metric-icon {
    font-size: 14px;
  }

  .tt-metric-label {
    font-size: 11px;
    color: #9ca3af;
    font-weight: 500;
    flex: 1;
  }

  .tt-metric-value {
    font-size: 14px;
    font-weight: 700;
    color: #f1f1f4;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .tt-bar-track {
    height: 5px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .tt-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tt-stats {
    display: flex;
    gap: 10px;
    font-size: 10px;
    color: #6b7280;
    font-family: 'JetBrains Mono', monospace;
  }

  .tt-stat {
    white-space: nowrap;
  }

  .tt-hint {
    margin-top: 6px;
    font-size: 9px;
    color: #4b5563;
    text-align: center;
    letter-spacing: 0.05em;
  }
</style>
