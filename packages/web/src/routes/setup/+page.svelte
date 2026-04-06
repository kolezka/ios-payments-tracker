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

<div class="max-w-2xl mx-auto px-5 py-12">
  <h1 class="text-2xl font-bold text-text-primary tracking-tight mb-1">Setup Apple Shortcut</h1>
  <p class="text-sm text-text-secondary mb-8">Connect your iPhone to start tracking payments</p>

  <div class="glass-strong p-6 mb-4">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Your API Endpoint</h2>
    <div class="mb-3">
      <label class="text-xs text-text-dim mb-1 block">URL</label>
      <div class="flex gap-2">
        <code class="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-glass-border text-text-secondary text-xs font-mono truncate">{data.apiEndpoint}</code>
        <button onclick={() => copyToClipboard(data.apiEndpoint, 'url')}
          class="px-3 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-secondary text-xs hover:text-accent hover:border-accent/30 transition-colors cursor-pointer shrink-0">
          {copiedField === 'url' ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
    <div>
      <label class="text-xs text-text-dim mb-1 block">API Token</label>
      <div class="flex gap-2">
        <code class="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-glass-border text-text-secondary text-xs font-mono truncate">{data.token}</code>
        <button onclick={() => copyToClipboard(data.token, 'token')}
          class="px-3 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-secondary text-xs hover:text-accent hover:border-accent/30 transition-colors cursor-pointer shrink-0">
          {copiedField === 'token' ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  </div>

  <div class="glass p-6 mb-4">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Install Shortcut</h2>
    <p class="text-sm text-text-secondary mb-4">Automation for Wallet card tap. Automatically captures amount, merchant, and card name — no input needed.</p>
    <a href={data.importUrl}
      class="block w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors text-center">
      Add to Shortcuts
    </a>
    <p class="text-xs text-text-dim mt-3 text-center">Opens Shortcuts app with import dialog</p>
    <div class="mt-3 flex gap-2">
      <a href={data.downloadUrl}
        class="flex-1 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-secondary text-xs hover:text-accent hover:border-accent/30 transition-colors text-center">
        Download .shortcut file
      </a>
      <button onclick={() => copyToClipboard(data.importUrl, 'import')}
        class="flex-1 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-secondary text-xs hover:text-accent hover:border-accent/30 transition-colors cursor-pointer">
        {copiedField === 'import' ? 'Copied!' : 'Copy import link'}
      </button>
    </div>
  </div>

  <div class="glass p-6">
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
