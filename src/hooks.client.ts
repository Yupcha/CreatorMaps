// Client-side hooks — Sentry error boundary
import { initSentry } from '$lib/utils/sentry';

// Initialize Sentry on client load
initSentry();

export async function handleError({ error, event }: { error: unknown; event: any }) {
  const { captureException } = await import('$lib/utils/sentry');
  captureException(error);
  console.error('[Client Error]', error);
}
