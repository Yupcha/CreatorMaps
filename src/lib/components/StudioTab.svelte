<script lang="ts">
  import { Video, Route, Sparkles, Keyboard } from '@lucide/svelte';

  const tips = [
    { key: '⌘ + Click', desc: 'Add waypoint to route' },
    { key: 'Space', desc: 'Preview current flight' },
    { key: 'Esc', desc: 'Cancel recording' },
  ];
</script>

<div class="tab-section">
  <div class="section-title">Cinematic Studio</div>
  <p class="studio-desc">Build cinematic camera flights between locations and export as high-quality video. Use the search bar above to add waypoints.</p>

  <div class="tip-card">
    <div class="tip-header"><Sparkles size={14} /> How it works</div>
    <ol class="tip-list">
      <li>Click the search bar and type a location</li>
      <li>Add multiple stops with <strong>+ Add Stop</strong></li>
      <li>Choose a <strong>Flight Style</strong> (Orbit, Tracking, etc.)</li>
      <li>Set <strong>Duration</strong> and <strong>Resolution</strong></li>
      <li>Hit <strong>Preview</strong> to test, then <strong>Record</strong></li>
    </ol>
  </div>

  <div class="tip-card" style="margin-top: 8px;">
    <div class="tip-header"><Keyboard size={14} /> Quick Tips</div>
    <div class="shortcuts">
      {#each tips as tip}
        <div class="shortcut-row">
          <kbd>{tip.key}</kbd>
          <span>{tip.desc}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .studio-desc {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 12px;
    line-height: 1.5;
  }
  .tip-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .tip-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }
  .tip-list {
    margin: 0;
    padding-left: 18px;
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.8;
  }
  .tip-list strong {
    color: var(--accent-primary);
  }
  .shortcuts {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .shortcut-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-secondary);
  }
  kbd {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-primary);
    min-width: 60px;
    text-align: center;
  }
</style>
