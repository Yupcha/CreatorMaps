<script lang="ts">
  import { Search, MapPin, Loader2, X } from '@lucide/svelte';
  import { mapInstance } from '$lib/stores/mapStore';
  import { get } from 'svelte/store';

  let query = $state('');
  let results = $state<any[]>([]);
  let loading = $state(false);
  let isOpen = $state(false);
  let searchTimeout: any;

  async function performSearch(q: string) {
    if (!q || q.length < 2) {
      results = [];
      isOpen = false;
      return;
    }
    loading = true;
    isOpen = true;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=in&format=json&limit=5`);
      if (res.ok) {
        results = await res.json();
      }
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      loading = false;
    }
  }

  function handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    query = val;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(val), 500);
  }

  function clearSearch() {
    query = '';
    results = [];
    isOpen = false;
  }

  function selectResult(result: any) {
    const map = get(mapInstance);
    if (!map) return;

    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    map.flyTo({
      center: [lon, lat],
      zoom: 10,
      pitch: 45,
      bearing: 0,
      duration: 2500,
      essential: true
    });

    query = result.display_name.split(',')[0];
    isOpen = false;
  }
</script>

<div class="search-container">
  <div class="search-input-wrapper">
    <Search size={16} class="search-icon" />
    <input 
      type="text" 
      placeholder="Search cities, states..." 
      value={query}
      oninput={handleInput}
      onfocus={() => { if(query.length > 1) isOpen = true; }}
    />
    {#if loading}
      <Loader2 size={14} class="spinner" />
    {:else if query}
      <button class="clear-btn" onclick={clearSearch}><X size={14} /></button>
    {/if}
  </div>

  {#if isOpen && results.length > 0}
    <div class="search-dropdown">
      {#each results as result}
        <button class="search-result" onclick={() => selectResult(result)}>
          <MapPin size={14} class="result-icon" />
          <div class="result-text">
            <span class="result-main">{result.display_name.split(',')[0]}</span>
            <span class="result-sub">{result.display_name.split(',').slice(1).join(',')}</span>
          </div>
        </button>
      {/each}
    </div>
  {:else if isOpen && query.length > 1 && !loading}
    <div class="search-dropdown">
      <div class="no-results">No results found</div>
    </div>
  {/if}
</div>

<style>
  .search-container {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 300;
    width: 280px;
    font-family: var(--font-sans);
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: rgba(8, 8, 18, 0.8);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 12px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    transition: all 0.2s;
  }

  .search-input-wrapper:focus-within {
    border-color: rgba(99, 102, 241, 0.5);
    background: rgba(8, 8, 18, 0.95);
  }

  :global(.search-icon) {
    color: #9ca3af;
    margin-right: 8px;
  }

  input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #f1f1f4;
    font-size: 13px;
    font-family: inherit;
  }

  input::placeholder {
    color: #6b7280;
  }

  .clear-btn {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  .clear-btn:hover { color: #f1f1f4; background: rgba(255,255,255,0.1); }

  :global(.spinner) {
    color: #6366f1;
    animation: spin 1s linear infinite;
  }

  @keyframes spin { 100% { transform: rotate(360deg); } }

  .search-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: rgba(8, 8, 18, 0.95);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  }

  .search-result {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }

  .search-result:last-child { border-bottom: none; }
  .search-result:hover { background: rgba(255, 255, 255, 0.05); }

  :global(.result-icon) {
    color: #6366f1;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .result-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .result-main {
    font-size: 13px;
    font-weight: 600;
    color: #f1f1f4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-sub {
    font-size: 10px;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .no-results {
    padding: 12px;
    text-align: center;
    font-size: 12px;
    color: #9ca3af;
  }
</style>
