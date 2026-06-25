/**
 * India-native auto-titles keyed by metric — kills blank-page friction so the
 * one-tap flow ships with a punchy, viral-shaped title the creator can edit.
 */

import type { OverlayMetric } from '$lib/data/indiaConstants';

const TITLES: Record<OverlayMetric, string> = {
  population: "India's Most CROWDED States",
  gdpBillionUsd: "India's RICHEST States 2026",
  literacy: 'Most LITERATE States in India',
  area: "India's BIGGEST States"
};

const SUBTITLES: Record<OverlayMetric, string> = {
  population: 'by population',
  gdpBillionUsd: 'by GDP',
  literacy: 'by literacy rate',
  area: 'by land area'
};

export function titleFor(metric: OverlayMetric): string {
  return TITLES[metric];
}

export function subtitleFor(metric: OverlayMetric): string {
  return SUBTITLES[metric];
}
