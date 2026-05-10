<script lang="ts">
  import { onMount } from 'svelte';
  import { indiaStates } from '$lib/data/countryData';
  import { overlayMetric } from '$lib/stores/indiaGeoStore';
  import { METRIC_CONFIGS } from '$lib/data/indiaConstants';

  let chartDiv1: HTMLDivElement;
  let chartDiv2: HTMLDivElement;
  let Plotly: any;

  // Wait for component to mount before dynamically importing plotly to avoid SSR issues
  onMount(async () => {
    Plotly = (await import('plotly.js-dist-min')).default;
    renderCharts();
  });

  $effect(() => {
    // Re-render when the selected metric changes
    const _trigger = $overlayMetric;
    if (Plotly) {
      renderCharts();
    }
  });

  function renderCharts() {
    if (!Plotly || !chartDiv1 || !chartDiv2) return;

    // Chart 1: Scatter Plot (Population vs Area vs GDP)
    const scatterData = [{
      x: indiaStates.map(s => s.area),
      y: indiaStates.map(s => s.population),
      text: indiaStates.map(s => `${s.name}<br>GDP: $${s.gdpBillionUsd}B`),
      mode: 'markers',
      marker: {
        size: indiaStates.map(s => Math.sqrt(s.gdpBillionUsd) * 2), // Bubble size
        color: indiaStates.map(s => s.literacy),
        colorscale: 'Viridis',
        showscale: true,
        colorbar: { title: 'Literacy %', thickness: 10, len: 0.8 },
      }
    }];

    const scatterLayout = {
      title: 'Population vs Area (Bubble = GDP)',
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#f1f1f4', family: 'Inter, sans-serif', size: 10 },
      xaxis: { title: 'Area (km²)', gridcolor: 'rgba(255,255,255,0.1)' },
      yaxis: { title: 'Population', gridcolor: 'rgba(255,255,255,0.1)' },
      margin: { l: 50, r: 20, t: 30, b: 40 },
    };

    Plotly.newPlot(chartDiv1, scatterData, scatterLayout, { responsive: true, displayModeBar: false });

    // Chart 2: Bar Chart for Current Metric
    const metricConfig = METRIC_CONFIGS[$overlayMetric];
    
    // Sort states by current metric
    const sortedStates = [...indiaStates].sort((a, b) => (b[$overlayMetric] as number) - (a[$overlayMetric] as number)).slice(0, 10);

    const barData = [{
      x: sortedStates.map(s => s.name),
      y: sortedStates.map(s => s[$overlayMetric]),
      type: 'bar',
      marker: {
        color: metricConfig.colors[1],
        borderRadius: 4
      }
    }];

    const barLayout = {
      title: `Top 10 States by ${metricConfig.label}`,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#f1f1f4', family: 'Inter, sans-serif', size: 10 },
      xaxis: { tickangle: -45, gridcolor: 'rgba(255,255,255,0.1)' },
      yaxis: { gridcolor: 'rgba(255,255,255,0.1)' },
      margin: { l: 40, r: 20, t: 30, b: 60 },
    };

    Plotly.newPlot(chartDiv2, barData, barLayout, { responsive: true, displayModeBar: false });
  }
</script>

<div class="charts-container">
  <div class="chart-wrapper">
    <div bind:this={chartDiv1} class="plotly-chart"></div>
  </div>
  <div class="chart-wrapper">
    <div bind:this={chartDiv2} class="plotly-chart"></div>
  </div>
</div>

<style>
  .charts-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px;
  }
  .chart-wrapper {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    overflow: hidden;
    height: 250px;
  }
  .plotly-chart {
    width: 100%;
    height: 100%;
  }
</style>
