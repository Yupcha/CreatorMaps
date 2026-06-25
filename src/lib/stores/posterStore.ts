/**
 * Poster / Wallpaper studio state.
 *
 * Classic svelte/store writables (matching mapStore convention — NOT runes) so
 * the PosterStudio component and the +page.svelte scene-link hydration can both
 * drive them via `.set` / `get`.
 */

import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import { selectedStateName, getStateData } from '$lib/stores/indiaGeoStore';
import { normalizeStateName, METRIC_CONFIGS } from '$lib/data/indiaConstants';
import { formatIndianNumber, formatArea } from '$lib/data/countryData';
import { findCity } from '$lib/data/indianCities';
import { POSTER_PRESETS, type PosterAspectKey } from '$lib/poster/posterPresets';

// ─── UI / config state ───────────────────────────────────────
export const posterOpen = writable(false);
export const posterAspect = writable<PosterAspectKey>('9:16');
export const posterTitle = writable('');
export const posterSubtitle = writable('');
export const posterStatLine = writable('');
export const showWatermark = writable(true);
export const showQR = writable(true);
export const cleanMap = writable(false);
export const posterDpr = writable(2);
export const posterSvg = writable(false);
export const posterBusy = writable(false);
/** Non-empty when dpr was auto-reduced to respect the size caps. */
export const dprReducedNote = writable('');

/**
 * Build a default title/subtitle/stat line from the current selection.
 * Prefers a selected Indian state, then a same-named city, else a generic
 * "Incredible India" framing.
 */
export function seedPosterCopy(): void {
  const stateName = get(selectedStateName);
  if (stateName) {
    const normalized = normalizeStateName(stateName);
    const data = getStateData(normalized);
    if (data) {
      posterTitle.set(data.name);
      posterSubtitle.set(`Capital · ${data.capital}`);
      posterStatLine.set(
        [
          `POP ${formatIndianNumber(data.population)}`,
          formatArea(data.area),
          METRIC_CONFIGS.literacy.format(data.literacy)
        ].join('  ·  ')
      );
      return;
    }
    // Fall back to city metadata (e.g. a landmark/city selection).
    const city = findCity(normalized) || findCity(stateName);
    if (city) {
      posterTitle.set(city.name);
      posterSubtitle.set(city.famousFor[0] ?? city.state);
      posterStatLine.set(`${city.state}  ·  POP ${formatIndianNumber(city.population)}`);
      return;
    }
    // Last resort — at least title the selection.
    posterTitle.set(normalized || stateName);
    posterSubtitle.set('India');
    posterStatLine.set('');
    return;
  }

  // No selection — generic India poster.
  posterTitle.set('Incredible India');
  posterSubtitle.set('Make it yours');
  posterStatLine.set('Yupcha Maps');
}

/** Open the studio, seeding copy from the current selection (idempotent). */
export function openPoster(): void {
  seedPosterCopy();
  dprReducedNote.set('');
  posterOpen.set(true);
}

export function closePoster(): void {
  posterOpen.set(false);
  posterBusy.set(false);
}

/** Convenience: the preset label for the active aspect (for UI). */
export function aspectLabel(key: PosterAspectKey): string {
  return POSTER_PRESETS[key].label;
}
