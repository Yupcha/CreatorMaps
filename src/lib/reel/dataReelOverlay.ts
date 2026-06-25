/**
 * Canvas-2D overlay painter for the Data Reel EXPORT path.
 *
 * Passed as `drawOverlay(ctx, frame)` to {@link recordReel}. captureStream taps
 * only the WebGL canvas, so the leaderboard / counters / title / watermark must
 * be PAINTED here to appear in the file. This intentionally mirrors the on-app
 * preview layout (DataReelPanel) so on-screen == file.
 *
 * Pure function of (ctx, viewModel, opts) — no DOM, no stores. The reel clock /
 * sampling happens in dataReelEngine; this only paints a supplied view-model.
 */

import {
  METRIC_CONFIGS,
  formatMetric,
  type OverlayMetric
} from './metricFormat';
import { COLORS, FONT_TITLE, FONT_MONO, drawWatermark, safeZone } from '$lib/reels';
import type { ReelViewModel, ReelRow } from './dataReelTimeline';

export interface DataReelOverlayOpts {
  metric: OverlayMetric;
  title: string;
  subtitle?: string;
  width: number;
  height: number;
  watermark: boolean;
  /** Optional preloaded brand logo. */
  logo?: CanvasImageSource | null;
  /** Optional share URL painted as the watermark tagline. */
  shareUrl?: string;
  /** Optional top-N for the title card count. */
  topN?: number;
}

// Per-row gradient cache keyed by `${y0}|${y1}|${c0}|${c2}` to avoid rebuilding
// CanvasGradient objects every frame.
const gradCache = new Map<string, CanvasGradient>();

function rowGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  colors: [string, string, string]
): CanvasGradient {
  const key = `${Math.round(x0)}|${Math.round(x1)}|${colors[0]}|${colors[1]}|${colors[2]}`;
  let g = gradCache.get(key);
  if (!g) {
    g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.5, colors[1]);
    g.addColorStop(1, colors[2]);
    gradCache.set(key, g);
    if (gradCache.size > 64) gradCache.clear();
  }
  return g;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Paint the full Data Reel overlay for the given frame. */
export function drawDataReelOverlay(
  ctx: CanvasRenderingContext2D,
  vm: ReelViewModel,
  opts: DataReelOverlayOpts
): void {
  const { width: W, height: H } = opts;
  const portrait = H >= W;
  const safe = safeZone(W, H);
  const shortEdge = Math.min(W, H);

  // ---- intro curtain (black fade in over the intro window) ----
  if (vm.introProgress < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - vm.introProgress;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ---- title card (top safe zone) ----
  drawTitleCard(ctx, opts, safe, shortEdge, vm.introProgress);

  // ---- leaderboard (bottom ~40% safe zone for portrait) ----
  drawLeaderboard(ctx, vm, opts, safe, portrait);

  // ---- watermark ----
  if (opts.watermark) {
    drawWatermark(ctx, {
      w: W,
      h: H,
      logo: opts.logo,
      tagline: opts.shareUrl ?? 'made with Yupcha Maps',
      alpha: 0.85
    });
  }

  // ---- outro: gentle bg vignette pulse on the end card hold ----
  if (vm.outroProgress > 0) {
    ctx.save();
    ctx.globalAlpha = vm.outroProgress * 0.18;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  opts: DataReelOverlayOpts,
  safe: { x: number; y: number; w: number; h: number },
  shortEdge: number,
  introProgress: number
) {
  const cfg = METRIC_CONFIGS[opts.metric];
  const e = 1 - Math.pow(1 - Math.max(0, Math.min(1, introProgress)), 3);
  const rise = (1 - e) * shortEdge * 0.03;
  const cx = safe.x + safe.w / 2;
  const iconSize = Math.round(shortEdge * 0.08);
  const titleSize = Math.round(shortEdge * 0.058);
  const subSize = Math.round(shortEdge * 0.03);

  let y = safe.y + iconSize * 0.4 - rise;

  ctx.save();
  ctx.globalAlpha = e;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = shortEdge * 0.02;
  ctx.shadowOffsetY = shortEdge * 0.004;

  // metric icon (emoji)
  ctx.font = `${iconSize}px ${FONT_TITLE}`;
  ctx.fillText(cfg.icon, cx, y + iconSize);
  y += iconSize * 1.5;

  // title (wraps to 2 lines if long)
  ctx.font = `800 ${titleSize}px ${FONT_TITLE}`;
  ctx.fillStyle = COLORS.textPrimary;
  const lines = wrapText(ctx, opts.title, safe.w * 0.96);
  for (const line of lines) {
    ctx.fillText(line, cx, y + titleSize);
    y += titleSize * 1.12;
  }

  // subtitle / "Top N by …"
  const sub = opts.subtitle ?? cfg.label;
  ctx.font = `600 ${subSize}px ${FONT_MONO}`;
  ctx.fillStyle = COLORS.accentGreenLight;
  ctx.fillText((opts.topN ? `TOP ${opts.topN} · ` : '') + sub.toUpperCase(), cx, y + subSize);
  ctx.restore();
}

function drawLeaderboard(
  ctx: CanvasRenderingContext2D,
  vm: ReelViewModel,
  opts: DataReelOverlayOpts,
  safe: { x: number; y: number; w: number; h: number },
  portrait: boolean
) {
  const cfg = METRIC_CONFIGS[opts.metric];
  const W = opts.width;
  const H = opts.height;

  // Board occupies the bottom region. Portrait: bottom ~46% of safe zone.
  const boardTop = portrait ? safe.y + safe.h * 0.52 : safe.y + safe.h * 0.42;
  const boardBottom = safe.y + safe.h - Math.min(W, H) * 0.05; // leave room above watermark
  const boardH = boardBottom - boardTop;
  const x = safe.x;
  const boardW = safe.w;

  // Fixed slots so rows don't jump — slot count = max visible rows.
  const maxRows = Math.min(vm.rows.length || 1, portrait ? 12 : 8);
  if (maxRows === 0) return;
  const gap = boardH * 0.02;
  const rowH = (boardH - gap * (maxRows - 1)) / maxRows;
  const fontSize = Math.min(rowH * 0.46, Math.min(W, H) * 0.032);
  const monoSize = Math.min(rowH * 0.42, Math.min(W, H) * 0.03);

  for (let i = 0; i < vm.rows.length && i < maxRows; i++) {
    const row = vm.rows[i];
    const ry = boardTop + i * (rowH + gap);
    drawRow(ctx, row, opts, cfg, x, ry, boardW, rowH, fontSize, monoSize);
  }
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  row: ReelRow,
  opts: DataReelOverlayOpts,
  cfg: (typeof METRIC_CONFIGS)[OverlayMetric],
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
  monoSize: number
) {
  const alpha = Math.max(0, Math.min(1, row.settle * 1.2));
  const pad = h * 0.14;
  const badgeR = h * 0.34;
  const badgeCx = x + badgeR + pad;
  const badgeCy = y + h / 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  // row background (subtle glass)
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, x, y, w, h, h * 0.22);
  ctx.fill();

  // rank badge (scales in)
  const bs = Math.max(0.01, Math.min(1.12, row.badgeScale));
  ctx.save();
  ctx.translate(badgeCx, badgeCy);
  ctx.scale(bs, bs);
  ctx.beginPath();
  ctx.arc(0, 0, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = row.rank === 1 ? COLORS.accentGreen : 'rgba(255,255,255,0.12)';
  ctx.fill();
  ctx.fillStyle = row.rank === 1 ? COLORS.bg : COLORS.textPrimary;
  ctx.font = `800 ${badgeR * 1.0}px ${FONT_TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(row.rank), 0, badgeR * 0.04);
  ctx.restore();

  const textX = badgeCx + badgeR + pad;
  const valueRight = x + w - pad;

  // state name
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${fontSize}px ${FONT_TITLE}`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = fontSize * 0.3;
  ctx.fillText(row.state.name, textX, y + h * 0.46);

  // counter (mono, right aligned)
  ctx.textAlign = 'right';
  ctx.font = `700 ${monoSize}px ${FONT_MONO}`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(formatMetric(opts.metric, row.counter), valueRight, y + h * 0.46);
  ctx.shadowBlur = 0;

  // spark bar
  const barY = y + h * 0.62;
  const barH = h * 0.16;
  const barX0 = textX;
  const barFull = valueRight - barX0;
  // track
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, barX0, barY, barFull, barH, barH / 2);
  ctx.fill();
  // fill
  const fillW = Math.max(barH, (barFull * row.barWidth) / 100);
  const grad = rowGradient(ctx, barX0, barX0 + barFull, cfg.colors);
  ctx.fillStyle = grad;
  roundRect(ctx, barX0, barY, fillW, barH, barH / 2);
  ctx.fill();

  ctx.restore();
}

/** Word-wrap a string to fit maxWidth in the current ctx font. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}
