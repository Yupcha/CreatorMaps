/**
 * Shared reel export pipeline — captures the maplibre canvas to video at a
 * selectable aspect/resolution, with an offscreen-2D-canvas compositor so
 * text/title/watermark overlays actually land in the file.
 *
 * Generalizes CinematicBar.startCinematicRecording WITHOUT breaking it:
 * CinematicBar keeps its own inline recorder; new reels call {@link recordReel}.
 *
 * KEY MECHANICS
 *  - When `drawOverlay` is provided, an offscreen <canvas> at width×height is
 *    created; per frame it `drawImage(map.getCanvas())` (center-crop cover)
 *    then runs `drawOverlay(ctx, frame)`, and we `captureStream` the OFFSCREEN
 *    canvas (DOM/HTML overlays are otherwise invisible to captureStream).
 *  - Codec is negotiated (mp4/avc1 → webm/vp9 → vp8 → webm) for Safari/iOS.
 *  - On no-codec, falls back to a single PNG still of the final frame.
 *  - `recordingMode` is toggled so +page.svelte hides app chrome during capture.
 *  - Container resize is OPTIONAL (`resizeContainer`): set true to drive the map
 *    at exact export dims (matches CinematicBar behaviour, needed for flights);
 *    leave false for static-camera reels (Data Reel) and crop in the compositor.
 *  - try/finally guarantees container styles + map.resize() always restore.
 */

import { get } from 'svelte/store';
import { recordingMode, mapInstance } from '$lib/stores/mapStore';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { negotiateVideoCodec } from './codec';
import { bitrateForPixels, fpsForPixels } from './aspect';

export interface ReelFrame {
  /** Elapsed ms since recording animation start. */
  elapsedMs: number;
  /** Total duration ms. */
  durationMs: number;
  /** 0..1 progress. */
  progress: number;
  /** Output width (px). */
  width: number;
  /** Output height (px). */
  height: number;
}

export interface RecordReelOptions {
  map: MapLibreMap;
  /** Output width in px. */
  width: number;
  /** Output height in px. */
  height: number;
  /** Total animation/recording duration in ms. */
  durationMs: number;
  /** Drives the camera/scene. Resolves when the animation completes. */
  runAnimation: (signal: AbortSignal) => Promise<void>;
  /**
   * Per-frame 2D overlay painter. If provided, capture goes through an
   * offscreen compositor (map canvas blit + your overlay). Omit for raw
   * map-canvas capture (no overlay text in file).
   */
  drawOverlay?: (ctx: CanvasRenderingContext2D, frame: ReelFrame) => void;
  /** Download filename base (no extension). Default "yupcha-reel". */
  fileBaseName?: string;
  /** Explicit bitrate override (bits/sec). Default derived from pixel count. */
  bitrate?: number;
  /**
   * Force the live map container to width×height (like CinematicBar). Needed
   * when the camera animation must render at the target aspect (flights).
   * Default false — compositor center-crops the live canvas instead.
   */
  resizeContainer?: boolean;
  /** Abort the in-flight recording. */
  signal?: AbortSignal;
  /** Progress callback (0..1) for UI. */
  onProgress?: (p: number) => void;
}

export interface RecordReelResult {
  /** "video" if a media file was produced, "png" if codec fallback fired. */
  kind: 'video' | 'png';
  /** Chosen mime type. */
  mime: string;
  /** Object URL that was downloaded (already revoked by the time you read it). */
  fileName: string;
  /** True if the run was aborted before completion. */
  aborted: boolean;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Compute center-crop source rect so `src` fills `dst` (object-fit: cover). */
function coverRect(srcW: number, srcH: number, dstW: number, dstH: number) {
  const srcAR = srcW / srcH;
  const dstAR = dstW / dstH;
  let sw = srcW;
  let sh = srcH;
  if (srcAR > dstAR) {
    // source wider → crop sides
    sw = srcH * dstAR;
  } else {
    // source taller → crop top/bottom
    sh = srcW / dstAR;
  }
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Record a reel to a downloadable video (or PNG fallback).
 *
 * @returns metadata about the produced file.
 */
export async function recordReel(opts: RecordReelOptions): Promise<RecordReelResult> {
  const {
    map,
    width,
    height,
    durationMs,
    runAnimation,
    drawOverlay,
    fileBaseName = 'yupcha-reel',
    resizeContainer = false,
    signal,
    onProgress
  } = opts;

  const codec = negotiateVideoCodec();
  const fps = fpsForPixels(width, height);
  const bitrate = opts.bitrate ?? bitrateForPixels(width, height);

  // --- Container resize bookkeeping (only when requested) ---
  const container = map.getContainer();
  const saved = {
    width: container.style.width,
    height: container.style.height,
    position: container.style.position,
    top: container.style.top,
    left: container.style.left,
    transform: container.style.transform,
    zIndex: container.style.zIndex
  };

  const abort = new AbortController();
  if (signal) {
    if (signal.aborted) abort.abort();
    else signal.addEventListener('abort', () => abort.abort(), { once: true });
  }

  recordingMode.set(true);

  // compositor state
  let offscreen: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let rafId = 0;
  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  let animStart = 0;

  const restoreContainer = () => {
    if (!resizeContainer) return;
    container.style.width = saved.width;
    container.style.height = saved.height;
    container.style.position = saved.position;
    container.style.top = saved.top;
    container.style.left = saved.left;
    container.style.transform = saved.transform;
    container.style.zIndex = saved.zIndex;
    map.resize();
  };

  try {
    if (resizeContainer) {
      container.style.width = width + 'px';
      container.style.height = height + 'px';
      container.style.position = 'fixed';
      container.style.top = '50%';
      container.style.left = '50%';
      container.style.transform = 'translate(-50%, -50%)';
      container.style.zIndex = '9999';
      map.resize();
      await wait(1000); // warm-up so first frame isn't blank
    }

    const mapCanvas = map.getCanvas();

    // ----- PNG fallback when no video codec is supported (Safari edge) -----
    if (!codec.mimeType) {
      // run the animation to land on the final frame, then snapshot
      animStart = performance.now();
      await runAnimation(abort.signal);
      const still = document.createElement('canvas');
      still.width = width;
      still.height = height;
      const sctx = still.getContext('2d');
      if (sctx) {
        const { sx, sy, sw, sh } = coverRect(mapCanvas.width, mapCanvas.height, width, height);
        sctx.drawImage(mapCanvas, sx, sy, sw, sh, 0, 0, width, height);
        if (drawOverlay) {
          drawOverlay(sctx, { elapsedMs: durationMs, durationMs, progress: 1, width, height });
        }
      }
      await new Promise<void>((resolve) =>
        still.toBlob((blob) => {
          if (blob) downloadBlob(blob, `${fileBaseName}.png`);
          resolve();
        }, 'image/png')
      );
      return { kind: 'png', mime: 'image/png', fileName: `${fileBaseName}.png`, aborted: abort.signal.aborted };
    }

    // ----- Set up capture stream -----
    let captureCanvas: HTMLCanvasElement = mapCanvas;
    if (drawOverlay) {
      offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      ctx = offscreen.getContext('2d', { alpha: false });
      captureCanvas = offscreen;
    }

    const stream = captureCanvas.captureStream(fps);
    recorder = new MediaRecorder(stream, { mimeType: codec.mimeType, videoBitsPerSecond: bitrate });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<void>((resolve) => {
      recorder!.onstop = () => resolve();
    });

    // compositor loop (only when overlay present)
    if (offscreen && ctx) {
      const c = ctx;
      const off = offscreen;
      const draw = () => {
        if (abort.signal.aborted) return;
        const elapsedMs = animStart ? performance.now() - animStart : 0;
        const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
        const { sx, sy, sw, sh } = coverRect(mapCanvas.width, mapCanvas.height, off.width, off.height);
        c.drawImage(mapCanvas, sx, sy, sw, sh, 0, 0, off.width, off.height);
        drawOverlay!(c, { elapsedMs, durationMs, progress, width: off.width, height: off.height });
        onProgress?.(progress);
        rafId = requestAnimationFrame(draw);
      };
      rafId = requestAnimationFrame(draw);
    }

    recorder.start();
    animStart = performance.now();

    // run the camera/scene animation; try/finally ensures we always stop
    try {
      await runAnimation(abort.signal);
    } finally {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      // small tail so the last frame is captured
      await wait(150);
      if (recorder.state === 'recording') recorder.stop();
      await stopped;
    }

    const blob = new Blob(chunks, { type: codec.mimeType });
    const fileName = `${fileBaseName}.${codec.ext}`;
    if (!abort.signal.aborted && blob.size > 0) {
      downloadBlob(blob, fileName);
    }
    onProgress?.(1);
    return { kind: 'video', mime: codec.mimeType, fileName, aborted: abort.signal.aborted };
  } finally {
    if (rafId) cancelAnimationFrame(rafId);
    if (recorder && recorder.state === 'recording') {
      try {
        recorder.stop();
      } catch {
        /* noop */
      }
    }
    // free compositor canvas
    offscreen = null;
    ctx = null;
    chunks.length = 0;
    restoreContainer();
    recordingMode.set(false);
  }
}

/**
 * Capture a single high-res PNG still of the current map view (with optional
 * overlay), at the given aspect dimensions. Center-cropped cover. No flicker,
 * no container resize — reuses the live WebGL canvas (preserveDrawingBuffer is
 * set at map init). Use for POSTER quick-grabs and Data-Reel still fallbacks.
 */
export async function captureStill(opts: {
  map?: MapLibreMap;
  width: number;
  height: number;
  drawOverlay?: (ctx: CanvasRenderingContext2D, frame: ReelFrame) => void;
  fileBaseName?: string;
  /** If false, returns the Blob without downloading. Default true. */
  download?: boolean;
}): Promise<Blob | null> {
  const map = opts.map ?? get(mapInstance);
  if (!map) return null;
  const { width, height } = opts;
  const mapCanvas = map.getCanvas();
  const still = document.createElement('canvas');
  still.width = width;
  still.height = height;
  const sctx = still.getContext('2d');
  if (!sctx) return null;
  const { sx, sy, sw, sh } = coverRect(mapCanvas.width, mapCanvas.height, width, height);
  sctx.drawImage(mapCanvas, sx, sy, sw, sh, 0, 0, width, height);
  opts.drawOverlay?.(sctx, { elapsedMs: 0, durationMs: 0, progress: 1, width, height });
  const blob = await new Promise<Blob | null>((resolve) => still.toBlob(resolve, 'image/png'));
  if (blob && (opts.download ?? true)) downloadBlob(blob, `${opts.fileBaseName ?? 'yupcha-still'}.png`);
  return blob;
}
