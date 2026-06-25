/**
 * Trip Reel feature store — classic svelte/store writables (matches
 * mapStore/indiaGeoStore conventions, NOT runes).
 *
 * Single source of truth shared by:
 *  - the Toolbar entry button / hotkey (sets tripReelOpen),
 *  - +page.svelte's scene-link hydration (fills stops/style/etc. from ?scene=),
 *  - TripReelStudio.svelte (the creation UI).
 *
 * The serializable shape (stops/style/durationKey/aspect/music/title) mirrors
 * CinematicBar.saveSession and feeds the Foundation sceneLink encoder.
 */

import { writable } from 'svelte/store';
import type { AspectKey } from '$lib/reels';
import type { TripStop } from '$lib/flight/tripChoreography';

/** Creator-facing duration tiers (epic intentionally hidden — too long for reels). */
export type TripDurationKey = 'quick' | 'normal' | 'cinematic';

export const TRIP_DURATIONS: { key: TripDurationKey; label: string; sub: string; ms: number }[] = [
  { key: 'quick', label: 'Snappy', sub: '8s', ms: 8000 },
  { key: 'normal', label: 'Story', sub: '15s', ms: 15000 },
  { key: 'cinematic', label: 'Cinematic', sub: '30s', ms: 30000 }
];

/** A music option. `src` null === no audio (silent export). */
export interface TripMusicTrack {
  id: string;
  label: string;
  /** Path under static/ (e.g. /audio/wander.mp3) or null for "No Music". */
  src: string | null;
  bpm: number;
}

/**
 * Built-in track list. Audio files are expected under static/audio/. If a file
 * is missing the export still succeeds silently (Foundation attachAudioTrack is
 * a tolerant no-op in v1). VERIFY LICENSING before shipping any real track.
 */
export const TRIP_MUSIC: TripMusicTrack[] = [
  { id: 'none', label: 'No Music', src: null, bpm: 120 },
  { id: 'wander', label: 'Wander', src: '/audio/wander.mp3', bpm: 120 },
  { id: 'voyage', label: 'Voyage', src: '/audio/voyage.mp3', bpm: 100 },
  { id: 'sunrise', label: 'Sunrise Drive', src: '/audio/sunrise.mp3', bpm: 90 }
];

/** Whether the Trip Reel studio bottom-sheet is open. */
export const tripReelOpen = writable<boolean>(false);

/** Ordered itinerary stops. */
export const tripStops = writable<TripStop[]>([]);

/** Flight style — always 'triproute' for Trip Reel, kept for forward-compat. */
export const tripStyle = writable<'triproute'>('triproute');

/** Duration tier (default Snappy/8s). */
export const tripDurationKey = writable<TripDurationKey>('quick');

/** Export aspect (default 9:16 vertical). */
export const tripAspect = writable<AspectKey>('9:16');

/** Selected music track id. */
export const tripMusic = writable<string>('none');

/** Optional title card text. */
export const tripTitle = writable<string>('');

export const isRecording = writable<boolean>(false);
export const isPreviewing = writable<boolean>(false);

/** Reset to an empty itinerary. */
export function resetTrip(): void {
  tripStops.set([]);
  tripDurationKey.set('quick');
  tripAspect.set('9:16');
  tripMusic.set('none');
  tripTitle.set('');
}
