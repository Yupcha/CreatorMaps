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
    const { initPostHog } = await import('$lib/utils/analytics');
    initPostHog();
  });
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
