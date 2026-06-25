/**
 * Yupcha Maps — Reel FOUNDATION public API.
 *
 * Shared layer that ALL four reel/poster features import. Build features
 * against THIS module (`$lib/reels`) so there is a single source of truth.
 *
 * ── Export to video (9:16 / 1:1 / 16:9 + resolution tiers) ──────────────────
 *   import { recordReel, captureStill, resolveDimensions } from '$lib/reels';
 *   const { w, h } = resolveDimensions('9:16', 'fhd');   // 1080×1920
 *   await recordReel({
 *     map, width: w, height: h, durationMs,
 *     runAnimation: (signal) => myFlight(map, signal),   // drives the camera
 *     drawOverlay: (ctx, frame) => { ...title/watermark... }, // composited!
 *     fileBaseName: 'roots-reel'
 *   });
 *   // drawOverlay is REQUIRED for any text to appear in the file (captureStream
 *   // taps only the WebGL canvas — DOM overlays are invisible).
 *
 * ── Text / title / watermark overlay (paint inside drawOverlay) ─────────────
 *   import { drawTitleBlock, drawWatermark, drawLabel, drawCurtain,
 *            safeZone, loadBrandLogo, ensureFontsReady, COLORS } from '$lib/reels';
 *   await ensureFontsReady();                 // before first paint
 *   const logo = await loadBrandLogo();
 *   drawOverlay = (ctx, { width:w, height:h, progress }) => {
 *     drawTitleBlock(ctx, { title, subtitle, w, h, progress });
 *     drawWatermark(ctx, { w, h, logo, tagline: 'made with Yupcha Maps' });
 *   };
 *
 * ── Shareable / remixable scene-link ────────────────────────────────────────
 *   import { encodeScene, decodeScene, shareScene, copyShareLink } from '$lib/reels';
 *   await copyShareLink({ feature: 'roots', title, params: { place } });
 *   // decode in +page.ts load({url}): decodeScene(url.searchParams)
 *
 * ── Beat / tempo timing (audio stubbed for v2) ──────────────────────────────
 *   import { makeBeatGrid, BPM_PRESETS, easeOutCubic, springOvershoot } from '$lib/reels';
 *   const grid = makeBeatGrid(BPM_PRESETS.cinematic, durationMs);
 *   const tReveal = grid.at(6);  // 6th beat
 *
 * ── Shared store (aspect/resolution/watermark/title/progress) ───────────────
 *   import { reelAspect, reelResolution, reelWatermark, reelRendering,
 *            reelProgress } from '$lib/reels';
 */

// Aspect / resolution
export {
  ASPECT_PRESETS,
  RESOLUTION_SCALE,
  resolveDimensions,
  bitrateForPixels,
  fpsForPixels
} from './aspect';
export type { AspectKey, ResolutionKey, Dimensions } from './aspect';

// Codec
export { negotiateVideoCodec } from './codec';
export type { CodecChoice } from './codec';

// Recorder / still capture
export { recordReel, captureStill } from './recorder';
export type { RecordReelOptions, RecordReelResult, ReelFrame } from './recorder';

// Overlay compositing
export {
  drawTitleBlock,
  drawLabel,
  drawWatermark,
  drawCurtain,
  safeZone,
  loadBrandLogo,
  ensureFontsReady,
  FONT_TITLE,
  FONT_MONO,
  COLORS
} from './overlay';
export type { TitleBlockOpts, WatermarkOpts, SafeRect } from './overlay';

// Scene-link
export { encodeScene, decodeScene, buildShareUrl, shareScene, copyShareLink } from './sceneLink';
export type { Scene, SceneCamera, ReelFeature } from './sceneLink';

// Beat / tempo
export {
  makeBeatGrid,
  BPM_PRESETS,
  TIMING,
  attachAudioTrack,
  easeOutCubic,
  easeInOutSine,
  smoothInOut,
  springOvershoot
} from './beat';
export type { BeatGrid, BpmPresetKey } from './beat';

// Shared store
export {
  reelAspect,
  reelResolution,
  reelWatermark,
  reelTitle,
  reelSubtitle,
  reelRendering,
  reelProgress,
  pendingSceneFeature
} from './stores/reelStore';
