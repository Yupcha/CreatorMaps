<script lang="ts">
  import { cameraState, activeStyle } from '$lib/stores/mapStore';
</script>

<div class="info-bar glass-panel" id="info-bar">
  <div class="info-item">
    <span class="info-label">LAT</span>
    <span class="info-value">{$cameraState.lat.toFixed(4)}</span>
  </div>
  <div class="info-sep">·</div>
  <div class="info-item">
    <span class="info-label">LNG</span>
    <span class="info-value">{$cameraState.lng.toFixed(4)}</span>
  </div>
  <div class="info-sep">·</div>
  <div class="info-item">
    <span class="info-label">ZOOM</span>
    <span class="info-value">{$cameraState.zoom.toFixed(1)}</span>
  </div>
  <div class="info-sep">·</div>
  <div class="info-item">
    <span class="info-label">PITCH</span>
    <span class="info-value">{$cameraState.pitch}°</span>
  </div>
  <div class="info-sep">·</div>
  <div class="info-item">
    <span class="info-label">BEARING</span>
    <span class="info-value">{$cameraState.bearing}°</span>
  </div>
  <div class="info-sep">·</div>
  <div class="info-item">
    <span class="info-label">STYLE</span>
    <span class="info-value style-badge">{$activeStyle.toUpperCase()}</span>
  </div>
</div>

<style>
  .info-bar {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-panel, 100);
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-xl);
    font-family: var(--font-mono);
    font-size: 11px;
    animation: slideInUp 500ms cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .info-label {
    color: var(--text-tertiary);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
  }

  .info-value {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .info-sep {
    color: var(--text-tertiary);
    opacity: 0.3;
  }

  .style-badge {
    color: var(--text-accent);
    font-size: 9px;
    letter-spacing: 0.05em;
  }
</style>
