/**
 * Shareable scene-link: encode a feature + its params into a `?scene=` URL
 * query string and decode it back on load. This is the cross-cutting "remix"
 * mechanism every reel uses — open a link and the app reopens with the same
 * scene pre-loaded.
 *
 * Wire-up:
 *  - DECODE: src/routes/+page.ts `load({ url })` calls {@link decodeScene} and
 *    returns it as page data; +page.svelte hydrates the relevant store on mount.
 *  - ENCODE/SHARE: a feature builds a {@link Scene} and calls {@link shareScene}
 *    (updates the URL) and/or {@link copyShareLink} (clipboard).
 *
 * Encoding is base64url of compact JSON, version-gated so old links degrade
 * gracefully. Tolerant decode: returns null on anything malformed.
 */

import { goto } from '$app/navigation';
import type { MapStyleKey } from '$lib/stores/mapStore';
import type { AspectKey } from './aspect';

export type ReelFeature = 'roots' | 'trip' | 'data' | 'poster';

/** Camera pose — mirrors mapStore.cameraState shape. */
export interface SceneCamera {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

/**
 * The serializable scene. `feature` discriminates which builder hydrates it;
 * `params` is a free-form per-feature bag (kept short to keep links small).
 */
export interface Scene {
  /** Schema version — bump if the shape changes incompatibly. */
  v: number;
  feature: ReelFeature;
  /** Optional camera pose (poster / roots). */
  cam?: SceneCamera;
  /** Optional map style. */
  style?: MapStyleKey;
  /** Optional export aspect. */
  aspect?: AspectKey;
  /** Optional title/subtitle overlay text. */
  title?: string;
  subtitle?: string;
  /** Feature-specific params (place, stops, metric, etc.). */
  params?: Record<string, unknown>;
}

const VERSION = 1;
const PARAM = 'scene';

// ---- base64url helpers (unicode-safe) ----

function toBase64Url(json: string): string {
  // encodeURIComponent → percent-escape → bytes → btoa
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Encode a scene to a base64url string (no leading `?` or `scene=`). */
export function encodeScene(scene: Omit<Scene, 'v'> & { v?: number }): string {
  const payload: Scene = { ...scene, v: scene.v ?? VERSION };
  try {
    return toBase64Url(JSON.stringify(payload));
  } catch {
    return '';
  }
}

/**
 * Decode a scene from either a URLSearchParams, a full search string, or the
 * raw base64url token. Returns null if absent or malformed.
 */
export function decodeScene(input: URLSearchParams | string | null | undefined): Scene | null {
  if (!input) return null;
  let token: string | null = null;
  if (typeof input === 'string') {
    // accept "abc", "?scene=abc", "scene=abc"
    if (input.includes('=')) {
      try {
        token = new URLSearchParams(input.startsWith('?') ? input.slice(1) : input).get(PARAM);
      } catch {
        token = null;
      }
    } else {
      token = input;
    }
  } else {
    token = input.get(PARAM);
  }
  if (!token) return null;
  try {
    const scene = JSON.parse(fromBase64Url(token)) as Scene;
    if (!scene || typeof scene !== 'object') return null;
    if (typeof scene.v !== 'number' || scene.v > VERSION) return null; // future version → ignore
    if (typeof scene.feature !== 'string') return null;
    return scene;
  } catch {
    return null;
  }
}

/** Build the absolute shareable URL for a scene (origin + ?scene=). */
export function buildShareUrl(scene: Omit<Scene, 'v'> & { v?: number }): string {
  const enc = encodeScene(scene);
  if (typeof window === 'undefined') return `?${PARAM}=${enc}`;
  const base = window.location.origin + window.location.pathname;
  return `${base}?${PARAM}=${enc}`;
}

/**
 * Update the current URL to reflect the scene WITHOUT a reload (so the address
 * bar / back-forward holds the remixable state). SPA-friendly via SvelteKit goto.
 */
export async function shareScene(scene: Omit<Scene, 'v'> & { v?: number }): Promise<void> {
  const enc = encodeScene(scene);
  await goto(`?${PARAM}=${enc}`, { replaceState: true, keepFocus: true, noScroll: true });
}

/** Copy the absolute share URL to the clipboard. Returns the URL written. */
export async function copyShareLink(scene: Omit<Scene, 'v'> & { v?: number }): Promise<string> {
  const url = buildShareUrl(scene);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* clipboard blocked — caller can show the URL for manual copy */
  }
  return url;
}
