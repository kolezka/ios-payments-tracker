<script lang="ts">
  import { enhance } from "$app/forms";

  let { data, form: formResult }: { data: any; form: any } = $props();
  let adding = $state(false);
</script>

<div class="fixed inset-0 bg-ambient -z-10"></div>

<div class="max-w-2xl mx-auto px-5 pt-20 pb-12">
  <h1 class="text-2xl font-bold text-text-primary tracking-tight mb-1">Settings</h1>
  <p class="text-sm text-text-secondary mb-8">Manage webhooks and integrations</p>

  <!-- Add webhook -->
  <div class="glass-strong p-5 mb-4">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Add Webhook</h2>

    {#if formResult?.error}
      <div class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 mb-3 text-sm text-red-300">{formResult.error}</div>
    {/if}

    <form method="POST" action="?/create" use:enhance={() => { adding = true; return async ({ update }) => { adding = false; await update(); }; }}>
      <div class="space-y-3">
        <div>
          <label class="text-xs text-text-dim mb-1 block">Endpoint URL</label>
          <input type="url" name="url" required placeholder="https://example.com/webhook"
            class="w-full px-3 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 font-sans" />
        </div>

        <div>
          <label class="text-xs text-text-dim mb-1 block">Secret (optional, for HMAC-SHA256 signature)</label>
          <input type="text" name="secret" placeholder="your-webhook-secret"
            class="w-full px-3 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 font-mono" />
        </div>

        <div>
          <label class="text-xs text-text-dim mb-1.5 block">Events</label>
          <div class="flex gap-2">
            <label class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer has-[:checked]:bg-indigo-500/15 has-[:checked]:border-indigo-500/30 has-[:checked]:text-accent bg-white/[0.03] border border-glass-border text-text-muted hover:text-indigo-300">
              <input type="checkbox" name="events" value="transaction.created" checked class="sr-only" />
              transaction.created
            </label>
            <label class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer has-[:checked]:bg-indigo-500/15 has-[:checked]:border-indigo-500/30 has-[:checked]:text-accent bg-white/[0.03] border border-glass-border text-text-muted hover:text-indigo-300">
              <input type="checkbox" name="events" value="transaction.deleted" class="sr-only" />
              transaction.deleted
            </label>
          </div>
        </div>

        <button type="submit" disabled={adding}
          class="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors cursor-pointer">
          {adding ? 'Adding...' : 'Add Webhook'}
        </button>
      </div>
    </form>
  </div>

  <!-- Webhook list -->
  <div class="glass p-5">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Webhooks</h2>

    {#if data.webhooks.length === 0}
      <p class="text-sm text-text-muted text-center py-4">No webhooks configured</p>
    {:else}
      <div class="space-y-3">
        {#each data.webhooks as hook (hook.id)}
          <div class="flex items-start gap-3 p-3 rounded-lg bg-black/20 border border-glass-border">
            <div class="flex-1 min-w-0">
              <code class="text-xs text-text-secondary font-mono block truncate">{hook.url}</code>
              <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                {#each hook.events.split(",") as event}
                  <span class="px-2 py-0.5 rounded-full text-[0.65rem] bg-badge-indigo-bg text-badge-indigo-text">{event}</span>
                {/each}
                {#if hook.has_secret}
                  <span class="px-2 py-0.5 rounded-full text-[0.65rem] bg-badge-emerald-bg text-badge-emerald-text">signed</span>
                {/if}
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <form method="POST" action="?/toggle" use:enhance>
                <input type="hidden" name="id" value={hook.id} />
                <input type="hidden" name="active" value={!hook.active} />
                <button type="submit"
                  class="px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer
                    {hook.active
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-300'
                      : 'bg-white/[0.03] border border-glass-border text-text-muted hover:text-emerald-300 hover:border-emerald-500/30'}">
                  {hook.active ? 'On' : 'Off'}
                </button>
              </form>
              <form method="POST" action="?/delete" use:enhance>
                <input type="hidden" name="id" value={hook.id} />
                <button type="submit"
                  class="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-glass-border text-text-muted text-xs hover:text-red-300 hover:border-red-500/30 transition-colors cursor-pointer">
                  Delete
                </button>
              </form>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="mt-8 text-center">
    <a href="/" class="text-accent text-sm hover:underline">Back to dashboard</a>
  </div>
</div>
