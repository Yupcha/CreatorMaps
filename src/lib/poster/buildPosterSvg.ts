/**
 * Vector SVG poster builder.
 *
 * Assembles a print-quality SVG: the map is embedded as a single raster
 * <image> layer (data: PNG) while the frame, title, subtitle, stats and
 * watermark are TRUE vector (<rect>/<line>/<text>) for crisp typography at any
 * print size. The QR is an optional vector <path>.
 *
 * String assembly only — no GL, no canvas. UI must label this as
 * "print quality (map is raster, text is vector)".
 */

import { POSTER_PRESETS, type PosterAspectKey } from './posterPresets';
import { makeQrSvgPaths } from './qr';

const ACCENT = '#6366f1';
const BG = '#0a0a0f';
const TEXT_PRIMARY = '#ffffff';
const TEXT_SECONDARY = '#a1a1aa';

export interface PosterSvgLayout {
  title?: string;
  subtitle?: string;
  statLine?: string;
  showWatermark?: boolean;
  showClean?: boolean;
  shareUrl?: string;
}

export interface BuildPosterSvgOptions {
  /** Composited (or raw map) PNG as a data URL to embed. */
  mapPngDataUrl: string;
  aspect: PosterAspectKey;
  layout: PosterSvgLayout;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPosterSvg(opts: BuildPosterSvgOptions): Blob {
  const preset = POSTER_PRESETS[opts.aspect];
  const W = preset.w;
  const H = preset.h;
  const { layout } = opts;
  const uiScale = Math.min(W, H) / 1080;

  const pad = Math.round(48 * uiScale);
  const inset = Math.round(28 * uiScale);
  const cl = Math.round(56 * uiScale);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, sans-serif">`
  );

  // Defs: bottom scrim gradient.
  parts.push(
    `<defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${BG}" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="${BG}" stop-opacity="0.88"/>` +
      `</linearGradient></defs>`
  );

  // Background + map (object-fit cover via preserveAspectRatio slice).
  parts.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);
  parts.push(
    `<image href="${opts.mapPngDataUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
  );

  if (!layout.showClean) {
    const scrimH = Math.round(H * 0.42);
    parts.push(`<rect x="0" y="${H - scrimH}" width="${W}" height="${scrimH}" fill="url(#scrim)"/>`);

    // Frame.
    parts.push(
      `<rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${H - inset * 2}" rx="${Math.round(18 * uiScale)}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="${Math.max(1, Math.round(2 * uiScale))}"/>`
    );
    // Accent corners.
    const sw = Math.max(2, Math.round(4 * uiScale));
    parts.push(
      `<path d="M${inset} ${inset + cl} L${inset} ${inset} L${inset + cl} ${inset}" fill="none" stroke="${ACCENT}" stroke-width="${sw}" stroke-linecap="round"/>`
    );
    parts.push(
      `<path d="M${W - inset} ${H - inset - cl} L${W - inset} ${H - inset} L${W - inset - cl} ${H - inset}" fill="none" stroke="${ACCENT}" stroke-width="${sw}" stroke-linecap="round"/>`
    );

    const baseY = H - pad - Math.round(60 * uiScale);
    const tx = pad + inset;

    // Eyebrow dash.
    parts.push(
      `<rect x="${tx}" y="${baseY - Math.round(118 * uiScale)}" width="${Math.round(56 * uiScale)}" height="${Math.round(5 * uiScale)}" fill="${ACCENT}"/>`
    );

    let cursorY = baseY;
    if (layout.statLine) {
      parts.push(
        `<text x="${tx}" y="${cursorY}" font-family="'JetBrains Mono', monospace" font-weight="500" font-size="${Math.round(28 * uiScale)}" fill="${TEXT_SECONDARY}">${esc(layout.statLine)}</text>`
      );
      cursorY -= Math.round(46 * uiScale);
    }
    if (layout.subtitle) {
      parts.push(
        `<text x="${tx}" y="${cursorY}" font-weight="600" font-size="${Math.round(40 * uiScale)}" fill="${TEXT_SECONDARY}">${esc(layout.subtitle)}</text>`
      );
      cursorY -= Math.round(70 * uiScale);
    }
    if (layout.title) {
      parts.push(
        `<text x="${tx}" y="${cursorY}" font-weight="700" font-size="${Math.round(82 * uiScale)}" fill="${TEXT_PRIMARY}">${esc(layout.title)}</text>`
      );
    }

    if (layout.showWatermark !== false) {
      parts.push(
        `<text x="${tx}" y="${H - pad}" font-weight="600" font-size="${Math.round(26 * uiScale)}" fill="rgba(255,255,255,0.78)">Yupcha Maps</text>`
      );
    }

    // QR (vector path).
    if (layout.shareUrl) {
      const qrSize = Math.round(150 * uiScale);
      const qx = W - inset - pad - qrSize;
      const qy = H - inset - pad - qrSize;
      const { d, size } = makeQrSvgPaths(layout.shareUrl);
      const scale = qrSize / size;
      parts.push(
        `<rect x="${qx - Math.round(8 * uiScale)}" y="${qy - Math.round(8 * uiScale)}" width="${qrSize + Math.round(16 * uiScale)}" height="${qrSize + Math.round(16 * uiScale)}" rx="${Math.round(10 * uiScale)}" fill="#ffffff"/>`
      );
      parts.push(
        `<g transform="translate(${qx} ${qy}) scale(${scale})"><path d="${d}" fill="#000000"/></g>`
      );
      parts.push(
        `<text x="${W - inset - pad}" y="${qy - Math.round(14 * uiScale)}" text-anchor="end" font-family="'JetBrains Mono', monospace" font-weight="500" font-size="${Math.round(18 * uiScale)}" fill="rgba(255,255,255,0.7)">scan to remix</text>`
      );
    }
  }

  parts.push('</svg>');
  return new Blob([parts.join('')], { type: 'image/svg+xml' });
}
