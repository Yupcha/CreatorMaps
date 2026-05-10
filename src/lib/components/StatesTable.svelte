<script lang="ts">
  import {
    createSvelteTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
  } from '@tanstack/svelte-table';
  import { indiaStates, formatIndianNumber, formatArea, type IndiaStateData } from '$lib/data/countryData';
  import { mapInstance } from '$lib/stores/mapStore';
  import { get } from 'svelte/store';

  let { onSelectState }: { onSelectState?: (state: IndiaStateData) => void } = $props();

  let sorting = $state<SortingState>([{ id: 'population', desc: true }]);
  let globalFilter = $state('');

  const columns: ColumnDef<IndiaStateData, any>[] = [
    {
      accessorKey: 'name',
      header: 'State',
      cell: (info) => info.getValue(),
      size: 120,
    },
    {
      accessorKey: 'capital',
      header: 'Capital',
      cell: (info) => info.getValue(),
      size: 90,
    },
    {
      accessorKey: 'population',
      header: '👥 Pop',
      cell: (info) => formatIndianNumber(info.getValue() as number),
      size: 70,
    },
    {
      accessorKey: 'area',
      header: '📐 Area',
      cell: (info) => formatArea(info.getValue() as number),
      size: 80,
    },
    {
      accessorKey: 'gdpBillionUsd',
      header: '💰 GDP',
      cell: (info) => `$${info.getValue()}B`,
      size: 60,
    },
    {
      accessorKey: 'literacy',
      header: '📚 Lit%',
      cell: (info) => `${(info.getValue() as number).toFixed(1)}%`,
      size: 55,
    },
  ];

  const table = createSvelteTable({
    get data() { return indiaStates; },
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      get sorting() { return sorting; },
      get globalFilter() { return globalFilter; },
    },
    onSortingChange: (updater) => {
      sorting = typeof updater === 'function' ? updater(sorting) : updater;
    },
    onGlobalFilterChange: (updater) => {
      globalFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
    },
  });

  // State coordinates for flyTo
  const stateCoords: Record<string, { lat: number; lng: number; zoom: number }> = {
    'Maharashtra': { lat: 19.7515, lng: 75.7139, zoom: 6 },
    'Uttar Pradesh': { lat: 26.8467, lng: 80.9462, zoom: 6 },
    'Tamil Nadu': { lat: 11.1271, lng: 78.6569, zoom: 6.5 },
    'Karnataka': { lat: 15.3173, lng: 75.7139, zoom: 6.5 },
    'Gujarat': { lat: 22.2587, lng: 71.1924, zoom: 6.5 },
    'Rajasthan': { lat: 27.0238, lng: 74.2179, zoom: 6 },
    'West Bengal': { lat: 22.9868, lng: 87.855, zoom: 6.5 },
    'Kerala': { lat: 10.8505, lng: 76.2711, zoom: 7 },
    'Delhi NCT': { lat: 28.7041, lng: 77.1025, zoom: 10 },
    'Goa': { lat: 15.2993, lng: 74.124, zoom: 9 },
  };

  function handleRowClick(state: IndiaStateData) {
    onSelectState?.(state);
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
</script>

<div class="table-wrapper">
  <input
    class="table-search"
    type="text"
    placeholder="Search states, capitals, languages..."
    bind:value={globalFilter}
  />

  <div class="table-scroll">
    <table class="states-table">
      <thead>
        {#each $table.getHeaderGroups() as headerGroup}
          <tr>
            {#each headerGroup.headers as header}
              <th
                class:sortable={header.column.getCanSort()}
                onclick={header.column.getToggleSortingHandler()}
                style="width: {header.getSize()}px"
              >
                <div class="th-content">
                  {#if !header.isPlaceholder}
                    {header.column.columnDef.header}
                  {/if}
                  {#if header.column.getIsSorted() === 'asc'}
                    <span class="sort-icon">↑</span>
                  {:else if header.column.getIsSorted() === 'desc'}
                    <span class="sort-icon">↓</span>
                  {/if}
                </div>
              </th>
            {/each}
          </tr>
        {/each}
      </thead>
      <tbody>
        {#each $table.getRowModel().rows as row}
          <tr class="data-row" onclick={() => handleRowClick(row.original)}>
            {#each row.getVisibleCells() as cell}
              <td>{cell.getValue()}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="table-footer">
    {$table.getRowModel().rows.length} of {indiaStates.length} states
  </div>
</div>

<style>
  .table-wrapper {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
  }

  .table-search {
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
  .table-search:focus { border-color: var(--accent-primary); }
  .table-search::placeholder { color: var(--text-tertiary); }

  .table-scroll {
    flex: 1;
    overflow: auto;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
  }

  .states-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    font-family: var(--font-sans);
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  th {
    padding: 6px 8px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--bg-control);
    border-bottom: 1px solid var(--border-medium);
    white-space: nowrap;
    user-select: none;
  }
  th.sortable {
    cursor: pointer;
  }
  th.sortable:hover {
    color: var(--text-secondary);
  }

  .th-content {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .sort-icon {
    color: var(--accent-primary);
    font-weight: 700;
  }

  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .data-row {
    cursor: pointer;
    transition: background var(--transition-fast);
  }
  .data-row:hover {
    background: var(--bg-control-hover);
  }

  .table-footer {
    font-size: 10px;
    color: var(--text-tertiary);
    text-align: right;
    padding: 2px 4px;
    font-family: var(--font-mono);
  }
</style>
