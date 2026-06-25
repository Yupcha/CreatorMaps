/**
 * Thin re-export + a counter-friendly formatter for the Data Reel.
 *
 * The rolling counter passes through fractional in-between values (e.g. 1.4e8),
 * so we format them the same way METRIC_CONFIGS does, with a couple of guards
 * for the in-flight values (integers for population/area, the configured
 * decimals for gdp/literacy).
 */

import {
  METRIC_CONFIGS as _METRIC_CONFIGS,
  type OverlayMetric as _OverlayMetric
} from '$lib/data/indiaConstants';

export const METRIC_CONFIGS = _METRIC_CONFIGS;
export type OverlayMetric = _OverlayMetric;

/** Format an (possibly mid-roll) metric value for the counter display. */
export function formatMetric(metric: OverlayMetric, value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  switch (metric) {
    case 'gdpBillionUsd':
      return `$${Math.round(v)}B`;
    case 'literacy':
      return `${v.toFixed(1)}%`;
    case 'area':
      return `${Math.round(v).toLocaleString('en-IN')} km²`;
    case 'population':
    default:
      // population formatter (Cr/L style) — use config format on rounded value
      return _METRIC_CONFIGS[metric].format(Math.round(v));
  }
}
