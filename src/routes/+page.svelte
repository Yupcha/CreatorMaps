<script lang="ts">
  import MapCanvas from '$lib/components/MapCanvas.svelte';
  import ControlPanel from '$lib/components/ControlPanel.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import LocationSearch from '$lib/components/LocationSearch.svelte';
  import InfoBar from '$lib/components/InfoBar.svelte';
  import DataPanel from '$lib/components/DataPanel.svelte';
  import StateTooltip from '$lib/components/StateTooltip.svelte';
</script>

<svelte:head>
  <title>India 3D Map — Content Creator Toolkit</title>
  <meta name="description" content="Capture stunning 3D map screenshots, SVGs, and styled visuals of India. Terrain, satellite, buildings, globe views with visual filters." />
</svelte:head>

<div class="app-root" id="app-root">
  <MapCanvas />
  <ControlPanel />
  <Toolbar />
  <LocationSearch />
  <InfoBar />
  <DataPanel />
  <StateTooltip />
</div>

<style>
  .app-root {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
</style>
