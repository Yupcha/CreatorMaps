// Sentry Error Tracking
// Set PUBLIC_SENTRY_DSN in .env to enable

import { browser } from '$app/environment';

let sentryInstance: any = null;

/**
 * Initialize Sentry. Call once in hooks.client.ts.
 * Requires PUBLIC_SENTRY_DSN env variable.
 */
export async function initSentry(): Promise<void> {
  if (!browser) return;

  const dsn = import.meta.env.PUBLIC_SENTRY_DSN;
  if (!dsn || dsn === 'https://your_dsn_here@sentry.io/0') {
    console.debug('[Sentry] DSN not configured — skipping init');
    return;
  }

  try {
    const Sentry = await import('@sentry/sveltekit');
    Sentry.init({
      dsn,
      tracesSampleRate: 0.2,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      environment: import.meta.env.MODE,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
    });
    sentryInstance = Sentry;
    console.debug('[Sentry] Initialized');
  } catch (e) {
    console.warn('[Sentry] Init failed:', e);
  }
}

/**
 * Capture an exception manually.
 */
export function captureException(error: unknown): void {
  sentryInstance?.captureException(error);
}

/**
 * Set user context for Sentry.
 */
export function setUser(user: { id: string; email?: string }): void {
  sentryInstance?.setUser(user);
}
