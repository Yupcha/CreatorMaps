/**
 * Poster map renderer — produces a WebGL canvas of the map at (or larger than)
 * a target size WITHOUT the CinematicBar live-container-resize hack (which
 * causes flicker, blank frames > 8192px, and a recordingMode flash).
 *
 * Strategy:
 *   1. {@link clampDimensions} the requested size against WebGL caps.
 *   2. If the requested backing pixels fit inside the LIVE map's existing
 *      canvas backing store, reuse it directly (zero latency — the common
 *      phone-wallpaper case). `preserveDrawingBuffer: true` at map init
 *      (MapCanvas.svelte) makes reading back the live canvas safe.
 *   3. Otherwise spin up a disposable offscreen `maplibregl.Map` in a detached,
 *      laid-out-but-hidden div, copy the current style + camera, await
 *      `idle`, return its canvas, and ALWAYS `map.remove()` in finally to free
 *      the GL context (no context leak across repeated exports).
 *
 * The compositor (`composePoster`) handles center-crop to the final aspect, so
 * this module only needs to produce a canvas at least as large as the target.
 */

import maplibregl from 'maplibre-gl';
import { get } from 'svelte/store';
import { mapInstance, activeStyle, mapStyles, type MapStyleKey } from '$lib/stores/mapStore';
import { clampDimensions, type ClampResult } from './posterPresets';

export interface RenderPosterOptions {
  /** Target width in CSS px (preset.w). */
  width: number;
  /** Target height in CSS px (preset.h). */
  height: number;
  /** Requested device pixel ratio (will be clamped). */
  dpr: number;
  /** Optional style override; defaults to the live activeStyle. */
  style?: MapStyleKey;
  /** Optional camera override; defaults to the live map pose. */
  camera?: { lng: number; lat: number; zoom: number; pitch: number; bearing: number };
}

export interface RenderPosterResult {
  /** The source canvas to composite from (live OR offscreen). */
  canvas: HTMLCanvasElement;
  /** True if a throwaway offscreen map produced this canvas (already removed). */
  offscreen: boolean;
  /** The clamp result actually used (effective dpr, reduced flag, px sizes). */
  clamp: ClampResult;
}

/** Resolve a MapStyleKey to a maplibre style URL string or inline spec object. */
function resolveStyleSpec(key: MapStyleKey): string | object {
  const style = mapStyles.find((s) => s.key === key);
  if (!style) return mapStyles[0].url;
  try {
    return JSON.parse(style.url);
  } catch {
    return style.url;
  }
}

/**
 * Render the poster map. Returns a canvas at least `clamp.pxW × clamp.pxH`.
 * Caller composites/crops to the exact target.
 */
export async function renderPosterCanvas(opts: RenderPosterOptions): Promise<RenderPosterResult> {
  const clamp = clampDimensions(opts.width, opts.height, opts.dpr);
  const live = get(mapInstance);

  // ── Fast path: reuse the live canvas when it already has enough pixels. ──
  if (live) {
    const liveCanvas = live.getCanvas();
    const wantSameStyle = !opts.style || opts.style === get(activeStyle);
    const wantSameCamera = !opts.camera;
    if (
      wantSameStyle &&
      wantSameCamera &&
      liveCanvas.width >= clamp.pxW &&
      liveCanvas.height >= clamp.pxH
    ) {
      return { canvas: liveCanvas, offscreen: false, clamp };
    }
  }

  // ── High-res / overridden path: disposable offscreen map. ──
  const styleKey = opts.style ?? get(activeStyle);
  const cam =
    opts.camera ??
    (live
      ? {
          lng: live.getCenter().lng,
          lat: live.getCenter().lat,
          zoom: live.getZoom(),
          pitch: live.getPitch(),
          bearing: live.getBearing()
        }
      : { lng: 78.9629, lat: 22.0, zoom: 4.5, pitch: 0, bearing: 0 });

  // Detached, laid-out (NOT display:none) so the GL context renders. Hidden via
  // visibility + offscreen positioning so it never flashes on screen.
  const holder = document.createElement('div');
  holder.style.cssText = [
    'position:fixed',
    'left:-99999px',
    'top:0',
    'visibility:hidden',
    'pointer-events:none',
    `width:${clamp.w}px`,
    `height:${clamp.h}px`,
    'z-index:-1'
  ].join(';');
  document.body.appendChild(holder);

  let offMap: maplibregl.Map | null = null;
  try {
    offMap = new maplibregl.Map({
      container: holder,
      style: resolveStyleSpec(styleKey) as any,
      center: [cam.lng, cam.lat],
      zoom: cam.zoom,
      pitch: cam.pitch,
      bearing: cam.bearing,
      pixelRatio: clamp.dpr,
      // `preserveDrawingBuffer` is a valid runtime canvas attr (mirrors
      // MapCanvas init) but absent from this maplibre version's MapOptions
      // type, so the options object is cast — same pattern as MapCanvas.svelte.
      preserveDrawingBuffer: true,
      fadeDuration: 0,
      attributionControl: false,
      interactive: false
      // Esri raster tiles are served with permissive CORS headers, so the
      // canvas is NOT tainted and toBlob() succeeds without SecurityError.
    } as any);

    await waitForIdle(offMap);

    // Force a synchronous repaint so the backing buffer is fresh before readback.
    offMap.triggerRepaint();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    // Detach the canvas from maplibre's lifecycle BEFORE remove() by snapshotting
    // into a standalone 2D canvas — otherwise map.remove() frees the GL context
    // and the source canvas goes blank.
    const src = offMap.getCanvas();
    const snapshot = document.createElement('canvas');
    snapshot.width = src.width;
    snapshot.height = src.height;
    const sctx = snapshot.getContext('2d')!;
    sctx.drawImage(src, 0, 0);

    return { canvas: snapshot, offscreen: true, clamp };
  } finally {
    try {
      offMap?.remove();
    } catch {
      /* ignore */
    }
    holder.remove();
  }
}

/** Resolve once the offscreen map is idle (tiles loaded + render settled). */
function waitForIdle(map: maplibregl.Map, timeoutMs = 12000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      map.off('idle', onIdle);
      resolve();
    };
    const onIdle = () => {
      if (map.loaded() && map.areTilesLoaded()) finish();
    };
    map.on('idle', onIdle);
    // Generous safety timeout for streaming raster styles.
    const timer = setTimeout(finish, timeoutMs);
  });
}
