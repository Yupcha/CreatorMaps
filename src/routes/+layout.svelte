<script lang="ts">
  import type { Snippet } from 'svelte';
  import '../app.css';
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import { onMount } from 'svelte';

  let { children }: { children: Snippet } = $props();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,     // 5 min
        gcTime: 30 * 60 * 1000,        // 30 min garbage collection
        refetchOnWindowFocus: false,
        retry: 2,
      },
    },
  });

  onMount(async () => {
    // Clear any STALE service worker / cached manifest from a previous build.
    // This project ships no SW or PWA plugin, so the manifest.webmanifest 404
    // in dev comes from a browser-cached registration — unregister it cleanly.
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        /* best-effort cleanup */
      }
    }

    const { initPostHog } = await import('$lib/utils/analytics');
    initPostHog();
  });
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
