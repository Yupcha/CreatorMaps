<script lang="ts">
  import {
    hoveredStateName, hoveredDistrictName, hoveredMousePos, selectedStateName,
    overlayMetric, getStateData,
  } from '$lib/stores/indiaGeoStore';
  import { METRIC_CONFIGS } from '$lib/data/indiaConstants';
  import { Users, Ruler, BookOpen, MapPin, BarChart3, Navigation, CloudSun } from '@lucide/svelte';
  import { fetchWeather, type WeatherData } from '$lib/utils/weather';
  import NumberFlow from '@number-flow/svelte';

  const stateData = $derived.by(() => {
    const name = $hoveredStateName;
    if (!name) return null;
    return getStateData(name) ?? null;
  });

  const districtName = $derived($hoveredDistrictName);

  let weatherData = $state<WeatherData | null>(null);
  let weatherLocation = $state<string | null>(null);

  // Debounced weather fetch
  $effect(() => {
    const loc = districtName || (stateData ? stateData.name : null);
    if (loc !== weatherLocation) {
      weatherLocation = loc;
      weatherData = null; // Clear old data immediately
      if (loc) {
        const timer = setTimeout(async () => {
          weatherData = await fetchWeather(loc);
        }, 400); // 400ms debounce
        return () => clearTimeout(timer);
      }
    }
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
        <span class="tt-name">{districtName ? districtName : stateData.name}</span>
        {#if isSelected}
          <span class="tt-selected-badge">SELECTED</span>
        {/if}
      </div>
      <span class="tt-capital">{districtName ? `${stateData.name} State` : stateData.capital}</span>
    </div>
    <div class="tt-divider"></div>
    <div class="tt-metric-row">
      <span class="tt-metric-icon"><BarChart3 size={13} /></span>
      <span class="tt-metric-label">{metricConfig.label}</span>
      <span class="tt-metric-value">
        {#if $overlayMetric === 'population'}
          <NumberFlow value={metricValue} locales="en-IN" />
        {:else if $overlayMetric === 'gdpBillionUsd'}
          $<NumberFlow value={metricValue} />B
        {:else if $overlayMetric === 'literacy'}
          <NumberFlow value={metricValue} format={{ maximumFractionDigits: 1 }} />%
        {:else}
          <NumberFlow value={metricValue} locales="en-IN" />
        {/if}
      </span>
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

    {#if weatherData}
      <div class="tt-weather">
        <CloudSun size={12} color="#f59e0b" />
        <span class="weather-temp">{weatherData.temp}°C</span>
        <span class="weather-cond">{weatherData.condition}</span>
      </div>
    {/if}

    <div class="tt-hint">Click to focus</div>
  </div>
{/if}

<style>
  .state-tooltip {
    position: fixed;
    z-index: 500;
    min-width: 200px;
    max-width: 240px;
    padding: 10px 12px;
    background: var(--glass-bg);
    backdrop-filter: blur(24px) saturate(1.8);
    -webkit-backdrop-filter: blur(24px) saturate(1.8);
    border: 1px solid var(--glass-border);
    border-radius: 10px;
    box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.1);
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
    gap: 0px;
  }

  .tt-name-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tt-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .tt-selected-badge {
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #6366f1;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .tt-capital {
    font-size: 9px;
    color: var(--text-accent);
    font-weight: 500;
  }

  .tt-divider {
    height: 1px;
    margin: 6px 0;
    background: var(--border-subtle);
  }

  .tt-metric-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .tt-metric-icon {
    font-size: 13px;
  }

  .tt-metric-label {
    font-size: 10px;
    color: var(--text-secondary);
    font-weight: 500;
    flex: 1;
  }

  .tt-metric-value {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .tt-bar-track {
    height: 3px;
    background: var(--bg-control);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .tt-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tt-stats {
    display: flex;
    gap: 8px;
    font-size: 9px;
    color: var(--text-tertiary);
    font-family: 'JetBrains Mono', monospace;
  }

  .tt-stat {
    white-space: nowrap;
  }

  .tt-hint {
    margin-top: 4px;
    font-size: 8px;
    color: var(--text-tertiary);
    text-align: center;
    letter-spacing: 0.05em;
  }

  .tt-weather {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px dashed var(--border-medium);
  }

  .weather-temp {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .weather-cond {
    font-size: 9px;
    color: var(--text-secondary);
    text-transform: capitalize;
  }
</style>
