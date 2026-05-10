<script lang="ts">
  import MapCanvas from "$lib/components/MapCanvas.svelte";
  import ControlPanel from "$lib/components/ControlPanel.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import CinematicBar from "$lib/components/CinematicBar.svelte";
  import InfoBar from "$lib/components/InfoBar.svelte";
  import DataPanel from "$lib/components/DataPanel.svelte";
  import StateTooltip from "$lib/components/StateTooltip.svelte";
  import {
    recordingMode,
    activeStyle,
    show3DOverlay,
  } from "$lib/stores/mapStore";
</script>

<svelte:head>
  <title>Yupcha Maps — Content Creator Toolkit</title>
  <meta
    name="description"
    content="Capture stunning 3D map screenshots, SVGs, and styled visuals of India. Terrain, satellite, buildings, globe views with visual filters."
  />
</svelte:head>

<div
  class="app-root"
  class:light-theme={$activeStyle === "liberty" ||
    $activeStyle === "bright" ||
    $activeStyle === "positron"}
  id="app-root"
>
  <MapCanvas />
  <CinematicBar />

  {#if !$recordingMode}
    <ControlPanel />
    <Toolbar />
    <InfoBar />
    <DataPanel />
    <StateTooltip />

    {#if $show3DOverlay}
      {#await import("$lib/components/ThreeDOverlay.svelte") then module}
        <module.default visible={$show3DOverlay} />
      {/await}
    {/if}
  {/if}
</div>

<style>
  .app-root {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
</style>
