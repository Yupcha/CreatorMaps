<script lang="ts">
  import MapCanvas from "$lib/components/MapCanvas.svelte";
  import ControlPanel from "$lib/components/ControlPanel.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import CinematicBar from "$lib/components/CinematicBar.svelte";
  import InfoBar from "$lib/components/InfoBar.svelte";
  import DataPanel from "$lib/components/DataPanel.svelte";
  import StateTooltip from "$lib/components/StateTooltip.svelte";
  import RootsReel from "$lib/components/RootsReel.svelte";
  import TripReelStudio from "$lib/components/TripReelStudio.svelte";
  import {
    recordingMode,
    activeStyle,
    show3DOverlay,
    panelOpen,
    activeTab,
  } from "$lib/stores/mapStore";
  import { onMount } from "svelte";
  import {
    pendingSceneFeature,
    reelAspect,
    reelTitle,
    reelSubtitle,
  } from "$lib/reels";
  import {
    tripReelOpen,
    tripStops,
    tripDurationKey,
    tripMusic,
    type TripDurationKey,
  } from "$lib/stores/tripReelStore";
  import { parseTripSceneParams } from "$lib/flight/tripReel";
  import {
    reelMetric,
    reelDurationKey,
    reelBpm,
    reelTopN,
    reelBearingDrift,
    type ReelDurationKey,
  } from "$lib/stores/reelStore";
  import { reelWatermark } from "$lib/reels";
  import {
    posterOpen,
    posterTitle,
    posterSubtitle,
    posterAspect,
    posterStatLine,
  } from "$lib/stores/posterStore";
  import type { OverlayMetric } from "$lib/data/indiaConstants";
  import type { PosterAspectKey } from "$lib/poster/posterPresets";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // Hydrate shared reel state from a decoded ?scene= share-link. Feature
  // components read $pendingSceneFeature to open themselves & load their params.
  onMount(() => {
    const scene = data?.scene;
    if (!scene) return;
    if (scene.style) activeStyle.set(scene.style);
    if (scene.aspect) reelAspect.set(scene.aspect);
    if (scene.title) reelTitle.set(scene.title);
    if (scene.subtitle) reelSubtitle.set(scene.subtitle);
    pendingSceneFeature.set(scene.feature);

    const params = (scene.params ?? {}) as Record<string, unknown>;

    // Trip Reel: rebuild the itinerary and open the studio pre-filled.
    if (scene.feature === "trip") {
      const parsed = parseTripSceneParams(scene.params);
      if (parsed) {
        tripStops.set(parsed.stops);
        if (parsed.durationKey)
          tripDurationKey.set(parsed.durationKey as TripDurationKey);
        if (parsed.music) tripMusic.set(parsed.music);
        tripReelOpen.set(true);
      }
    }

    // Data Reel: hydrate reel config and open the Data Reel tab.
    if (scene.feature === "data") {
      if (params.metric) reelMetric.set(params.metric as OverlayMetric);
      if (params.durationKey)
        reelDurationKey.set(params.durationKey as ReelDurationKey);
      if (typeof params.bpm === "number") reelBpm.set(params.bpm);
      if (typeof params.topN === "number") reelTopN.set(params.topN);
      if (typeof params.watermark === "boolean")
        reelWatermark.set(params.watermark);
      if (typeof params.drift === "boolean")
        reelBearingDrift.set(params.drift);
      if (scene.title) reelTitle.set(scene.title);
      panelOpen.set(true);
      activeTab.set("datareel");
    }

    // Poster: restore poster-specific copy/aspect and open the modal.
    if (scene.feature === "poster") {
      if (scene.title) posterTitle.set(scene.title);
      if (scene.subtitle) posterSubtitle.set(scene.subtitle);
      if (params.aspect) posterAspect.set(params.aspect as PosterAspectKey);
      if (params.statLine != null)
        posterStatLine.set(String(params.statLine));
      posterOpen.set(true);
    }
  });
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
  <RootsReel />
  <TripReelStudio />

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

    {#if $posterOpen}
      {#await import("$lib/components/PosterStudio.svelte") then m}
        <m.default />
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
