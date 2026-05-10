<script lang="ts">
  import { mapInstance } from '$lib/stores/mapStore';
  import { searchLocations, type IndianLocation } from '$lib/data/indianLocations';
  import { get } from 'svelte/store';

  let query = $state('');
  let isOpen = $state(false);
  let selectedIdx = $state(-1);
  let inputEl: HTMLInputElement;

  const results = $derived(searchLocations(query));

  $effect(() => {
    if (query.length > 0) {
      isOpen = true;
    } else {
      isOpen = false;
      selectedIdx = -1;
    }
  });

  function flyToLocation(loc: IndianLocation) {
    const map = get(mapInstance);
    if (!map) return;
    map.flyTo({
      center: [loc.lng, loc.lat],
      zoom: loc.zoom,
      pitch: loc.pitch ?? 45,
      bearing: loc.bearing ?? 0,
      duration: 2500,
      essential: true,
    });
    query = '';
    isOpen = false;
    inputEl?.blur();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault();
      flyToLocation(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      isOpen = false;
      inputEl?.blur();
    }
  }
</script>

<div class="search-wrapper" id="location-search">
  <div class="search-box glass-panel">
    <span class="search-icon">🔍</span>
    <input
      bind:this={inputEl}
      bind:value={query}
      onkeydown={handleKeydown}
      onfocus={() => { if (query.length > 0) isOpen = true; }}
      placeholder="Search Indian cities & landmarks..."
      type="text"
      class="search-input"
      id="search-input"
    />
    {#if query.length > 0}
      <button class="clear-btn" onclick={() => { query = ''; }}>✕</button>
    {/if}
  </div>

  {#if isOpen && results.length > 0}
    <div class="search-dropdown glass-panel">
      {#each results as loc, i}
        <button
          class="search-result"
          class:highlighted={i === selectedIdx}
          onclick={() => flyToLocation(loc)}
          onmouseenter={() => (selectedIdx = i)}
        >
          <div class="result-main">
            <span class="result-name">{loc.name}</span>
            {#if loc.state}
              <span class="result-state">{loc.state}</span>
            {/if}
          </div>
          {#if loc.description}
            <span class="result-desc">{loc.description}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .search-wrapper {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-toolbar, 200);
    width: 360px;
    max-width: calc(100vw - 380px);
    animation: slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
  }

  .search-icon {
    font-size: 14px;
    opacity: 0.5;
  }

  .search-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 400;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .clear-btn {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: none;
    background: var(--bg-control);
    color: var(--text-tertiary);
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }
  .clear-btn:hover {
    background: var(--bg-control-hover);
    color: var(--text-primary);
  }

  .search-dropdown {
    margin-top: var(--space-xs);
    max-height: 320px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    animation: fadeIn 150ms ease;
  }

  .search-result {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-sm) var(--space-md);
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-sans);
    color: var(--text-primary);
    transition: background var(--transition-fast);
    border-bottom: 1px solid var(--border-subtle);
  }
  .search-result:last-child { border-bottom: none; }
  .search-result:hover, .search-result.highlighted {
    background: var(--bg-control-hover);
  }

  .result-main {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .result-name {
    font-size: 13px;
    font-weight: 600;
  }
  .result-state {
    font-size: 11px;
    color: var(--text-tertiary);
  }
  .result-desc {
    font-size: 11px;
    color: var(--text-tertiary);
  }
</style>
