/**
 * MediaRecorder codec negotiation.
 *
 * The existing CinematicBar recorder hardcodes `video/webm;codecs=vp9`, which
 * silently produces an empty/broken file on Safari/iOS (the diaspora audience
 * for vertical reels). This picks the first supported mime from a preference
 * list and reports the correct download extension.
 */

export interface CodecChoice {
  /** mimeType to pass to MediaRecorder, or null if none supported. */
  mimeType: string | null;
  /** File extension matching the chosen codec (e.g. "mp4", "webm"). */
  ext: string;
}

/** Preference order: mp4/avc1 first (Safari), then webm variants (Chrome/FF). */
const VIDEO_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm'
];

function extFromMime(mime: string): string {
  if (mime.startsWith('video/mp4')) return 'mp4';
  if (mime.startsWith('video/webm')) return 'webm';
  return 'webm';
}

/**
 * Negotiate the best supported video codec for this browser.
 * Returns `{ mimeType: null }` if MediaRecorder is unavailable or no candidate
 * is supported — callers should then fall back to a PNG still.
 */
export function negotiateVideoCodec(): CodecChoice {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return { mimeType: null, ext: 'webm' };
  }
  for (const mime of VIDEO_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return { mimeType: mime, ext: extFromMime(mime) };
    }
  }
  return { mimeType: null, ext: 'webm' };
}
