import { decodeScene } from '$lib/reels';

export const ssr = false;
export const prerender = false;

/**
 * Decode any `?scene=` reel/poster share-link on load (runs client-side since
 * ssr=false). +page.svelte hydrates the matching feature store from `data.scene`
 * after the map instance is ready. Returns `{ scene: null }` for normal loads.
 */
export function load({ url }: { url: URL }) {
  return { scene: decodeScene(url.searchParams) };
}
