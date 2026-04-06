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

  {#if data.icloudUrl}
    <div class="glass p-5 mb-4">
      <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Option A &mdash; Quick Install</h2>
      <p class="text-sm text-text-secondary mb-4">Install via iCloud and paste your credentials when prompted.</p>
      <a href={data.icloudUrl}
        class="block w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors text-center">
        Add to Shortcuts
      </a>
      <p class="text-xs text-text-dim mt-3 text-center">Opens Shortcuts app &mdash; paste API URL and Token from above when asked</p>
    </div>
  {/if}

  <div class="glass p-5 mb-4">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">
      {#if data.icloudUrl}Option B &mdash; {:else}Install &mdash; {/if}Manual Setup
    </h2>
    <ol class="text-sm text-text-secondary space-y-3 list-decimal list-inside">
      <li>
        Open the <strong class="text-text-primary">Shortcuts</strong> app and tap <strong class="text-text-primary">+</strong> to create a new shortcut
      </li>
      <li>
        Add action <strong class="text-text-primary">Dictionary</strong> with these keys:
        <div class="mt-1.5 ml-5 space-y-1 text-xs">
          <div><code class="text-indigo-300">amount</code> &rarr; <span class="text-text-dim">Amount (Wallet variable)</span></div>
          <div><code class="text-indigo-300">seller</code> &rarr; <span class="text-text-dim">Merchant (Wallet variable)</span></div>
          <div><code class="text-indigo-300">card</code> &rarr; <span class="text-text-dim">Card (Wallet variable)</span></div>
        </div>
      </li>
      <li>
        Add action <strong class="text-text-primary">Get Contents of URL</strong>:
        <div class="mt-1.5 ml-5 space-y-1 text-xs">
          <div>URL &rarr; <button onclick={() => copyToClipboard(data.apiEndpoint, 'step-url')} class="text-indigo-300 underline cursor-pointer">{copiedField === 'step-url' ? 'Copied!' : 'copy API URL'}</button></div>
          <div>Method &rarr; <strong class="text-text-primary">POST</strong></div>
          <div>Headers &rarr; <code class="text-indigo-300">Authorization</code>: <button onclick={() => copyToClipboard(`Bearer ${data.token}`, 'step-bearer')} class="text-indigo-300 underline cursor-pointer">{copiedField === 'step-bearer' ? 'Copied!' : 'copy Bearer token'}</button></div>
          <div>Headers &rarr; <code class="text-indigo-300">Content-Type</code>: <span class="text-text-dim">application/json</span></div>
          <div>Body &rarr; <strong class="text-text-primary">Dictionary</strong> (from step 2)</div>
        </div>
      </li>
      <li>
        (Optional) Add action <strong class="text-text-primary">Show Notification</strong> to confirm the payment was logged
      </li>
      <li>
        Go to <strong class="text-text-primary">Automation</strong> tab &rarr; <strong class="text-text-primary">New Automation</strong> &rarr; <strong class="text-text-primary">Transaction</strong> &rarr; pick your card(s) &rarr; run this shortcut
      </li>
    </ol>
  </div>

  <div class="glass p-5">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">QR Code</h2>
    <div class="flex justify-center">
      <div class="w-40 h-40">
        {@html data.qrSvg}
      </div>
    </div>
    <p class="text-xs text-text-dim mt-3 text-center">Scan from your phone to open this setup page</p>
  </div>

  <div class="mt-8 text-center">
    <a href="/" class="text-accent text-sm hover:underline">Go to dashboard</a>
  </div>
</div>
