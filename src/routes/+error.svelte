<script lang="ts">
  import { page } from '$app/stores';
  import { AlertTriangle, Copy, RefreshCw } from '@lucide/svelte';

  const status = $derived($page.status);
  const error = $derived($page.error as App.Error | Error | null);
  
  let copied = $state(false);

  function copyError() {
    if (!error) return;
    const errorText = `Status: ${status}\nMessage: ${error?.message}\n\nStack:\n${(error as any)?.stack || 'No stack trace available'}`;
    navigator.clipboard.writeText(errorText);
    copied = true;
    setTimeout(() => copied = false, 2000);
  }
</script>

<svelte:head>
  <title>Error {status} — Yupcha Map</title>
</svelte:head>

<div class="error-page">
  <div class="error-container glass-panel">
    <div class="error-header">
      <div class="icon-wrapper">
        <AlertTriangle size={32} color="#ef4444" />
      </div>
      <div>
        <h1>{status} Error</h1>
        <p class="subtitle">Something went wrong during rendering.</p>
      </div>
    </div>

    {#if error}
      <div class="error-details">
        <div class="code-header">
          <span>Error Details</span>
          <button class="copy-btn" onclick={copyError}>
            {#if copied}
              Copied!
            {:else}
              <Copy size={14} /> Copy Log
            {/if}
          </button>
        </div>
        <pre><code><span class="err-msg">{error.message}</span>
{#if (error as any).stack}
<span class="err-stack">{(error as any).stack}</span>
{/if}</code></pre>
      </div>
    {/if}

    <div class="actions">
      <button class="btn btn-primary" onclick={() => window.location.reload()}>
        <RefreshCw size={16} /> Reload Page
      </button>
      <a href="/" class="btn btn-ghost">Return to Map</a>
    </div>
  </div>
</div>

<style>
  .error-page {
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at center, #1a1a2e, #0f0f1a);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 9999;
  }

  .error-container {
    max-width: 600px;
    width: 100%;
    padding: 32px;
    border-radius: 16px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(239, 68, 68, 0.1) inset;
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 24px;
  }

  .icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: rgba(239, 68, 68, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 4px 0;
    color: #f87171;
  }

  .subtitle {
    margin: 0;
    color: var(--text-secondary);
    font-size: 15px;
  }

  .error-details {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 24px;
  }

  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 12px;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .copy-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: color 0.2s;
  }

  .copy-btn:hover {
    color: white;
  }

  pre {
    margin: 0;
    padding: 16px;
    overflow-x: auto;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.5;
  }

  .err-msg {
    color: #fca5a5;
    font-weight: 600;
    display: block;
    margin-bottom: 12px;
  }

  .err-stack {
    color: #94a3b8;
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: white;
    color: black;
  }

  .btn-primary:hover {
    background: #f1f1f4;
    transform: translateY(-1px);
  }

  .btn-ghost {
    background: rgba(255, 255, 255, 0.05);
    color: white;
  }

  .btn-ghost:hover {
    background: rgba(255, 255, 255, 0.1);
  }
</style>
