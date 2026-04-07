<script lang="ts">
  let { data }: { data: any } = $props();
  let copiedField = $state<string | null>(null);

  async function copyToClipboard(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    copiedField = field;
    setTimeout(() => { copiedField = null; }, 2000);
  }
</script>

<div class="fixed inset-0 bg-ambient -z-10"></div>

<div class="max-w-2xl mx-auto px-5 pt-20 pb-12">
  <h1 class="text-2xl font-bold text-text-primary tracking-tight mb-1">Setup Apple Shortcut</h1>
  <p class="text-sm text-text-secondary mb-8">Connect your iPhone to start tracking payments</p>

  <div class="glass-strong p-5 mb-4">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Your Credentials</h2>
    <div class="mb-3">
      <label class="text-xs text-text-dim mb-1 block">API URL</label>
      <div class="flex gap-2">
        <code class="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/30 border border-glass-border text-text-secondary text-xs font-mono truncate">{data.apiEndpoint}</code>
        <button onclick={() => copyToClipboard(data.apiEndpoint, 'url')}
          class="px-3 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-secondary text-xs hover:text-accent hover:border-accent/30 transition-colors cursor-pointer shrink-0">
          {copiedField === 'url' ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
    <div>
      <label class="text-xs text-text-dim mb-1 block">API Token</label>
      <div class="flex gap-2">
        <code class="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/30 border border-glass-border text-text-secondary text-xs font-mono truncate">{data.token}</code>
        <button onclick={() => copyToClipboard(data.token, 'token')}
          class="px-3 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-secondary text-xs hover:text-accent hover:border-accent/30 transition-colors cursor-pointer shrink-0">
          {copiedField === 'token' ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  </div>

  {#if data.showAddShortcut && data.icloudUrl}
    <div class="glass p-5 mb-4">
      <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Add Shortcut</h2>
      <p class="text-sm text-text-secondary mb-4">Install via iCloud and paste your credentials when prompted.</p>
      <a href={data.icloudUrl}
        class="block w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors text-center">
        Add to Shortcuts
      </a>
      <p class="text-xs text-text-dim mt-3 text-center">Opens Shortcuts app &mdash; paste API URL and Token from above when asked</p>
    </div>
  {/if}

  {#if data.showDownloadShortcut}
    <div class="glass p-5 mb-4">
      <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Download Shortcut</h2>
      <p class="text-sm text-text-secondary mb-4">Download the .shortcut file with your API credentials baked in.</p>
      <a href={data.downloadUrl}
        class="block w-full py-3 rounded-xl bg-white/5 border border-glass-border-strong hover:bg-white/8 text-text-primary text-sm font-semibold transition-colors text-center">
        Download .shortcut
      </a>
      <p class="text-xs text-text-dim mt-3 text-center">Open the downloaded file to add it to Shortcuts</p>
    </div>
  {/if}

  <div class="glass p-5 mb-4">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-6">Manual Setup</h2>
    <div class="space-y-4">

      <!-- Step 1 -->
      <div class="flex gap-3">
        <div class="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0 mt-0.5">
          <span class="text-xs font-bold text-indigo-300">1</span>
        </div>
        <div>
          <p class="text-sm text-text-primary font-medium">Create a new shortcut</p>
          <p class="text-xs text-text-muted mt-1">Open the <strong class="text-text-secondary">Shortcuts</strong> app and tap <strong class="text-text-secondary">+</strong></p>
        </div>
      </div>

      <!-- Step 2 -->
      <div class="flex gap-3">
        <div class="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0 mt-0.5">
          <span class="text-xs font-bold text-indigo-300">2</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-text-primary font-medium">Add a Dictionary action</p>
          <p class="text-xs text-text-muted mt-1 mb-2">Map these keys to Wallet variables:</p>
          <div class="rounded-lg bg-black/25 border border-glass-border p-3 space-y-1.5">
            <div class="flex items-center gap-2 text-xs">
              <code class="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">amount</code>
              <svg class="w-3 h-3 text-text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              <span class="text-text-secondary">Amount</span>
              <span class="text-text-dim">(Wallet)</span>
            </div>
            <div class="flex items-center gap-2 text-xs">
              <code class="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">seller</code>
              <svg class="w-3 h-3 text-text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              <span class="text-text-secondary">Merchant</span>
              <span class="text-text-dim">(Wallet)</span>
            </div>
            <div class="flex items-center gap-2 text-xs">
              <code class="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">card</code>
              <svg class="w-3 h-3 text-text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              <span class="text-text-secondary">Card</span>
              <span class="text-text-dim">(Wallet)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3 -->
      <div class="flex gap-3">
        <div class="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0 mt-0.5">
          <span class="text-xs font-bold text-indigo-300">3</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-text-primary font-medium">Add Get Contents of URL</p>
          <p class="text-xs text-text-muted mt-1 mb-2">Configure the API request:</p>
          <div class="rounded-lg bg-black/25 border border-glass-border p-3 space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-text-muted">URL</span>
              <button onclick={() => copyToClipboard(data.apiEndpoint, 'step-url')}
                class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer font-mono text-[0.65rem]">
                {copiedField === 'step-url' ? 'Copied!' : 'Click to copy'}
              </button>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-text-muted">Method</span>
              <span class="text-text-primary font-medium">POST</span>
            </div>
            <div class="h-px bg-glass-border"></div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-text-muted">Authorization</span>
              <button onclick={() => copyToClipboard(`Bearer ${data.token}`, 'step-bearer')}
                class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer font-mono text-[0.65rem]">
                {copiedField === 'step-bearer' ? 'Copied!' : 'Click to copy'}
              </button>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-text-muted">Content-Type</span>
              <span class="text-text-secondary font-mono text-[0.65rem]">application/json</span>
            </div>
            <div class="h-px bg-glass-border"></div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-text-muted">Body</span>
              <span class="text-text-secondary">Dictionary <span class="text-text-dim">(from step 2)</span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 4 -->
      <div class="flex gap-3">
        <div class="w-7 h-7 rounded-full bg-white/[0.03] border border-glass-border flex items-center justify-center shrink-0 mt-0.5">
          <span class="text-xs font-bold text-text-dim">4</span>
        </div>
        <div>
          <p class="text-sm text-text-muted font-medium">Add Show Notification <span class="text-text-dim font-normal">(optional)</span></p>
          <p class="text-xs text-text-dim mt-1">Confirms each payment was logged successfully</p>
        </div>
      </div>

      <!-- Step 5 -->
      <div class="flex gap-3">
        <div class="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0 mt-0.5">
          <span class="text-xs font-bold text-indigo-300">5</span>
        </div>
        <div>
          <p class="text-sm text-text-primary font-medium">Create Wallet automation</p>
          <p class="text-xs text-text-muted mt-1"><strong class="text-text-secondary">Automation</strong> &rarr; <strong class="text-text-secondary">New Automation</strong> &rarr; <strong class="text-text-secondary">Transaction</strong> &rarr; pick your card(s) &rarr; run this shortcut</p>
        </div>
      </div>

    </div>
  </div>

  <div class="mt-8 text-center">
    <a href="/" class="text-accent text-sm hover:underline">Go to dashboard</a>
  </div>
</div>
