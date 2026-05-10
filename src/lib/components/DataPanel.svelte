<script lang="ts">
  import { indiaStates, fetchIndiaData, formatIndianNumber, formatArea, type CountryData, type IndiaStateData } from '$lib/data/countryData';
  import { mapInstance } from '$lib/stores/mapStore';
  import { get } from 'svelte/store';

  let open = $state(false);
  let activeView = $state<'country' | 'states' | 'rankings'>('country');
  let countryData = $state<CountryData | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let sortKey = $state<keyof IndiaStateData>('population');
  let sortAsc = $state(false);
  let selectedState = $state<IndiaStateData | null>(null);

  // Fetch India data on first open
  async function loadCountryData() {
    if (countryData) return;
    loading = true;
    error = null;
    try {
      countryData = await fetchIndiaData();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function togglePanel() {
    open = !open;
    if (open && !countryData) loadCountryData();
  }

  // Sorted & filtered states
  const filteredStates = $derived.by(() => {
    let list = [...indiaStates];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.capital.toLowerCase().includes(q) ||
        s.language.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortAsc ? va - vb : vb - va;
      }
      return sortAsc
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return list;
  });

  function flyToState(state: IndiaStateData) {
    selectedState = state;
    const loc = stateCoords[state.name];
    if (loc) {
      get(mapInstance)?.flyTo({
        center: [loc.lng, loc.lat],
        zoom: loc.zoom,
        pitch: 45,
        duration: 2000,
      });
    }
  }

  function cycleSortKey() {
    const keys: (keyof IndiaStateData)[] = ['population', 'area', 'gdpBillionUsd', 'literacy', 'name'];
    const idx = keys.indexOf(sortKey);
    sortKey = keys[(idx + 1) % keys.length];
  }

  // State coordinates for flyTo
  const stateCoords: Record<string, { lat: number; lng: number; zoom: number }> = {
    'Maharashtra': { lat: 19.7515, lng: 75.7139, zoom: 6 },
    'Uttar Pradesh': { lat: 26.8467, lng: 80.9462, zoom: 6 },
    'Tamil Nadu': { lat: 11.1271, lng: 78.6569, zoom: 6.5 },
    'Karnataka': { lat: 15.3173, lng: 75.7139, zoom: 6.5 },
    'Gujarat': { lat: 22.2587, lng: 71.1924, zoom: 6.5 },
    'Rajasthan': { lat: 27.0238, lng: 74.2179, zoom: 6 },
    'West Bengal': { lat: 22.9868, lng: 87.855, zoom: 6.5 },
    'Madhya Pradesh': { lat: 22.9734, lng: 78.6569, zoom: 6 },
    'Kerala': { lat: 10.8505, lng: 76.2711, zoom: 7 },
    'Telangana': { lat: 18.1124, lng: 79.0193, zoom: 7 },
    'Andhra Pradesh': { lat: 15.9129, lng: 79.74, zoom: 6.5 },
    'Punjab': { lat: 31.1471, lng: 75.3412, zoom: 7 },
    'Odisha': { lat: 20.9517, lng: 85.0985, zoom: 6.5 },
    'Bihar': { lat: 25.0961, lng: 85.3131, zoom: 7 },
    'Assam': { lat: 26.2006, lng: 92.9376, zoom: 7 },
    'Goa': { lat: 15.2993, lng: 74.124, zoom: 9 },
    'Himachal Pradesh': { lat: 31.1048, lng: 77.1734, zoom: 7.5 },
    'Uttarakhand': { lat: 30.0668, lng: 79.0193, zoom: 7.5 },
    'Jharkhand': { lat: 23.6102, lng: 85.2799, zoom: 7 },
    'Chhattisgarh': { lat: 21.2787, lng: 81.8661, zoom: 6.5 },
    'Haryana': { lat: 29.0588, lng: 76.0856, zoom: 7.5 },
    'Jammu & Kashmir': { lat: 33.7782, lng: 76.5762, zoom: 7 },
    'Delhi NCT': { lat: 28.7041, lng: 77.1025, zoom: 10 },
    'Sikkim': { lat: 27.533, lng: 88.5122, zoom: 9 },
    'Meghalaya': { lat: 25.467, lng: 91.3662, zoom: 8 },
    'Manipur': { lat: 24.6637, lng: 93.9063, zoom: 8.5 },
    'Mizoram': { lat: 23.1645, lng: 92.9376, zoom: 8 },
    'Nagaland': { lat: 26.1584, lng: 94.5624, zoom: 8 },
    'Tripura': { lat: 23.9408, lng: 91.9882, zoom: 8.5 },
    'Arunachal Pradesh': { lat: 28.218, lng: 94.7278, zoom: 7 },
  };

  const sortLabels: Record<string, string> = {
    population: '👥 Population',
    area: '📐 Area',
    gdpBillionUsd: '💰 GDP',
    literacy: '📚 Literacy',
    name: '🔤 Name',
  };
</script>

<!-- Toggle Button -->
<button class="data-toggle-btn" onclick={togglePanel} title="Country Data">
  📊
</button>

{#if open}
  <div class="data-panel glass-panel" id="data-panel">
    <div class="dp-header">
      <h2 class="dp-title">🇮🇳 India Data Explorer</h2>
      <button class="btn btn-icon" onclick={togglePanel}>✕</button>
    </div>

    <div class="dp-tabs">
      <button class="dp-tab" class:active={activeView === 'country'} onclick={() => (activeView = 'country')}>
        Overview
      </button>
      <button class="dp-tab" class:active={activeView === 'states'} onclick={() => (activeView = 'states')}>
        States
      </button>
      <button class="dp-tab" class:active={activeView === 'rankings'} onclick={() => (activeView = 'rankings')}>
        Rankings
      </button>
    </div>

    <div class="dp-body">
      {#if activeView === 'country'}
        {#if loading}
          <div class="dp-loading"><span class="spinner"></span> Loading...</div>
        {:else if error}
          <div class="dp-error">⚠️ {error}</div>
        {:else if countryData}
          <div class="metrics-grid">
            <div class="metric-card">
              <span class="metric-label">Population</span>
              <span class="metric-value">{formatIndianNumber(countryData.population)}</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">Area</span>
              <span class="metric-value">{formatArea(countryData.area)}</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">Capital</span>
              <span class="metric-value">{countryData.capital.join(', ')}</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">Region</span>
              <span class="metric-value">{countryData.subregion}</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">Timezones</span>
              <span class="metric-value">{countryData.timezones.join(', ')}</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">UN Member</span>
              <span class="metric-value">{countryData.unMember ? '✅ Yes' : '❌ No'}</span>
            </div>
          </div>

          <div class="section-divider"></div>
          <div class="info-row"><span class="info-key">Official Name</span><span class="info-val">{countryData.officialName}</span></div>
          <div class="info-row"><span class="info-key">Languages</span><span class="info-val">{Object.values(countryData.languages).join(', ')}</span></div>
          <div class="info-row"><span class="info-key">Currencies</span><span class="info-val">{Object.values(countryData.currencies).map(c => `${c.name} (${c.symbol})`).join(', ')}</span></div>
          <div class="info-row"><span class="info-key">Drives on</span><span class="info-val">{countryData.car?.side ?? 'left'} side</span></div>
          <div class="info-row"><span class="info-key">FIFA Code</span><span class="info-val">{countryData.fifa}</span></div>
          <div class="info-row"><span class="info-key">Top Domain</span><span class="info-val">{countryData.tld?.join(', ')}</span></div>
          <div class="info-row"><span class="info-key">Calling Code</span><span class="info-val">{countryData.idd?.root}{countryData.idd?.suffixes?.[0]}</span></div>
          <div class="info-row"><span class="info-key">Borders</span><span class="info-val">{countryData.borders.join(', ')}</span></div>
        {/if}
      {/if}

      {#if activeView === 'states'}
        <div class="states-toolbar">
          <input
            class="states-search"
            type="text"
            placeholder="Filter states..."
            bind:value={searchQuery}
          />
          <button class="sort-btn" onclick={cycleSortKey} title="Change sort">
            {sortLabels[sortKey] ?? sortKey}
            <span onclick={(e) => { e.stopPropagation(); sortAsc = !sortAsc; }} class="sort-dir">
              {sortAsc ? '↑' : '↓'}
            </span>
          </button>
        </div>

        <div class="states-list">
          {#each filteredStates as state (state.name)}
            <button
              class="state-card"
              class:selected={selectedState?.name === state.name}
              onclick={() => flyToState(state)}
            >
              <div class="state-top">
                <span class="state-name">{state.name}</span>
                <span class="state-capital">{state.capital}</span>
              </div>
              <div class="state-metrics">
                <span class="state-stat">👥 {formatIndianNumber(state.population)}</span>
                <span class="state-stat">📐 {formatArea(state.area)}</span>
                <span class="state-stat">📚 {state.literacy}%</span>
              </div>
              <div class="state-desc">{state.description}</div>
            </button>
          {/each}
        </div>
      {/if}

      {#if activeView === 'rankings'}
        <div class="rankings-section">
          <h3 class="rank-title">Top States by GDP (USD Billion)</h3>
          <div class="rank-bars">
            {#each [...indiaStates].sort((a, b) => b.gdpBillionUsd - a.gdpBillionUsd).slice(0, 10) as state, i}
              <div class="rank-row">
                <span class="rank-pos">#{i + 1}</span>
                <span class="rank-name">{state.name}</span>
                <div class="rank-bar-track">
                  <div
                    class="rank-bar-fill"
                    style:width="{(state.gdpBillionUsd / 440) * 100}%"
                    style:animation-delay="{i * 60}ms"
                  ></div>
                </div>
                <span class="rank-val">${state.gdpBillionUsd}B</span>
              </div>
            {/each}
          </div>

          <h3 class="rank-title" style="margin-top: 24px;">Top States by Literacy</h3>
          <div class="rank-bars">
            {#each [...indiaStates].sort((a, b) => b.literacy - a.literacy).slice(0, 10) as state, i}
              <div class="rank-row">
                <span class="rank-pos">#{i + 1}</span>
                <span class="rank-name">{state.name}</span>
                <div class="rank-bar-track">
                  <div
                    class="rank-bar-fill lit"
                    style:width="{state.literacy}%"
                    style:animation-delay="{i * 60}ms"
                  ></div>
                </div>
                <span class="rank-val">{state.literacy}%</span>
              </div>
            {/each}
          </div>

          <h3 class="rank-title" style="margin-top: 24px;">Top States by Population</h3>
          <div class="rank-bars">
            {#each [...indiaStates].sort((a, b) => b.population - a.population).slice(0, 10) as state, i}
              <div class="rank-row">
                <span class="rank-pos">#{i + 1}</span>
                <span class="rank-name">{state.name}</span>
                <div class="rank-bar-track">
                  <div
                    class="rank-bar-fill pop"
                    style:width="{(state.population / 200000000) * 100}%"
                    style:animation-delay="{i * 60}ms"
                  ></div>
                </div>
                <span class="rank-val">{formatIndianNumber(state.population)}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .data-toggle-btn {
    position: fixed;
    top: 16px;
    right: 60px;
    z-index: var(--z-toolbar, 200);
    width: 42px;
    height: 42px;
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    color: var(--text-primary);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-md);
  }
  .data-toggle-btn:hover {
    background: var(--bg-panel-hover);
    transform: scale(1.08);
  }

  .data-panel {
    position: fixed;
    top: 16px;
    right: 60px;
    bottom: 16px;
    width: 380px;
    z-index: var(--z-panel, 100);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideInRight 350ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  @media (max-width: 768px) {
    .data-panel {
      width: calc(100vw - 32px);
      right: 16px;
    }
  }

  .dp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--border-subtle);
  }
  .dp-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .dp-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-subtle);
    padding: 0 var(--space-sm);
  }
  .dp-tab {
    flex: 1;
    padding: var(--space-sm) var(--space-xs);
    border: none;
    background: none;
    color: var(--text-tertiary);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-normal);
    border-bottom: 2px solid transparent;
  }
  .dp-tab:hover { color: var(--text-secondary); }
  .dp-tab.active {
    color: var(--text-accent);
    border-bottom-color: var(--accent-primary);
  }

  .dp-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg);
  }

  .dp-loading, .dp-error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-2xl);
    color: var(--text-tertiary);
    font-size: 13px;
  }

  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-sm);
  }
  .metric-card {
    display: flex;
    flex-direction: column;
    padding: var(--space-md);
    border-radius: var(--radius-md);
    background: var(--bg-control);
    border: 1px solid var(--border-subtle);
    transition: border-color var(--transition-normal);
  }
  .metric-card:hover {
    border-color: var(--border-medium);
  }
  .metric-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }
  .metric-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .section-divider {
    height: 1px;
    background: var(--border-subtle);
    margin: var(--space-lg) 0;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 6px 0;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 12px;
  }
  .info-key { color: var(--text-tertiary); font-weight: 500; }
  .info-val { color: var(--text-primary); font-weight: 600; text-align: right; max-width: 55%; }

  /* States */
  .states-toolbar {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }
  .states-search {
    flex: 1;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-medium);
    background: var(--bg-control);
    color: var(--text-primary);
    font-size: 12px;
    font-family: var(--font-sans);
    outline: none;
    transition: border-color var(--transition-fast);
  }
  .states-search:focus { border-color: var(--accent-primary); }
  .states-search::placeholder { color: var(--text-tertiary); }

  .sort-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-medium);
    background: var(--bg-control);
    color: var(--text-secondary);
    font-size: 11px;
    font-family: var(--font-sans);
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--transition-normal);
  }
  .sort-btn:hover { border-color: var(--accent-primary); }
  .sort-dir {
    cursor: pointer;
    font-weight: 700;
    color: var(--text-accent);
  }

  .states-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  .state-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-md);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--bg-control);
    cursor: pointer;
    transition: all var(--transition-normal);
    text-align: left;
    width: 100%;
    font-family: var(--font-sans);
    color: var(--text-primary);
  }
  .state-card:hover {
    border-color: var(--accent-primary);
    background: var(--bg-control-hover);
    transform: translateX(4px);
  }
  .state-card.selected {
    border-color: var(--accent-primary);
    box-shadow: inset 0 0 0 1px var(--accent-primary);
  }
  .state-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .state-name { font-weight: 700; font-size: 13px; }
  .state-capital { font-size: 11px; color: var(--text-accent); }
  .state-metrics {
    display: flex;
    gap: var(--space-md);
    font-size: 11px;
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }
  .state-desc {
    font-size: 11px;
    color: var(--text-tertiary);
    line-height: 1.4;
  }

  /* Rankings */
  .rank-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: var(--space-md);
  }
  .rank-bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rank-row {
    display: grid;
    grid-template-columns: 24px 100px 1fr 55px;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }
  .rank-pos {
    color: var(--text-tertiary);
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 10px;
  }
  .rank-name {
    color: var(--text-primary);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rank-bar-track {
    height: 14px;
    background: var(--bg-control);
    border-radius: 7px;
    overflow: hidden;
    border: 1px solid var(--border-subtle);
  }
  .rank-bar-fill {
    height: 100%;
    border-radius: 7px;
    background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary, #6366f1));
    animation: barGrow 600ms cubic-bezier(0.4, 0, 0.2, 1) both;
  }
  .rank-bar-fill.lit {
    background: linear-gradient(90deg, #10b981, #34d399);
  }
  .rank-bar-fill.pop {
    background: linear-gradient(90deg, #f59e0b, #fb923c);
  }
  .rank-val {
    text-align: right;
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 10px;
  }

  @keyframes barGrow {
    from { width: 0 !important; }
  }

  @keyframes slideInRight {
    from { transform: translateX(20px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
</style>
