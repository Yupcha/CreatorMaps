// PostHog Analytics — lightweight event tracking
// Set PUBLIC_POSTHOG_KEY in .env to enable

import { browser } from '$app/environment';

let posthogInstance: any = null;

/**
 * Initialize PostHog. Call once in +layout.svelte on mount.
 * Requires PUBLIC_POSTHOG_KEY env variable.
 */
export async function initPostHog(): Promise<void> {
  if (!browser) return;

  const key = import.meta.env.PUBLIC_POSTHOG_KEY;
  if (!key || key === 'phc_your_key_here') {
    console.debug('[Analytics] PostHog key not configured — skipping init');
    return;
  }

  try {
    const posthog = (await import('posthog-js')).default;
    posthog.init(key, {
      api_host: 'https://us.i.posthog.com',
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      loaded: (ph) => {
        posthogInstance = ph;
        console.debug('[Analytics] PostHog initialized');
      },
    });
  } catch (e) {
    console.warn('[Analytics] PostHog init failed:', e);
  }
}

/**
 * Track a custom event.
 */
export function trackEvent(name: string, properties?: Record<string, any>): void {
  if (!posthogInstance) return;
  posthogInstance.capture(name, properties);
}

/**
 * Track map style change.
 */
export function trackStyleChange(style: string): void {
  trackEvent('map_style_changed', { style });
}

/**
 * Track export action.
 */
export function trackExport(format: string): void {
  trackEvent('map_exported', { format });
}

/**
 * Track preset applied.
 */
export function trackPreset(preset: string): void {
  trackEvent('preset_applied', { preset });
}

/**
 * Track fly-to location.
 */
export function trackFlyTo(location: string): void {
  trackEvent('fly_to_location', { location });
}
