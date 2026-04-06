<script lang="ts">
  import { enhance } from "$app/forms";

  let { form }: { form: any } = $props();
</script>

<div class="fixed inset-0 bg-ambient -z-10"></div>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <h1 class="text-2xl font-bold text-text-primary tracking-tight mb-1">Payment Tracker</h1>
    <p class="text-sm text-text-secondary mb-8">Sign in to continue</p>

    {#if form?.success}
      <div class="glass-strong p-6 text-center">
        <p class="text-accent text-lg font-semibold mb-2">Check your email</p>
        <p class="text-text-secondary text-sm">We sent a sign-in link to <strong class="text-text-primary">{form.email}</strong></p>
      </div>
    {:else}
      {#if form?.error}
        <div class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 mb-4 text-sm text-red-300">
          {form.error}
        </div>
      {/if}

      <form method="POST" action="?/magic-link" use:enhance class="mb-6">
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          value={form?.email ?? ""}
          autocomplete="email"
          required
          class="w-full px-4 py-3 rounded-xl bg-glass-bg border border-glass-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 mb-3 font-sans"
        />
        <button
          type="submit"
          class="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          Send magic link
        </button>
      </form>

      <div class="flex items-center gap-3 mb-6">
        <div class="flex-1 h-px bg-glass-border"></div>
        <span class="text-text-dim text-xs uppercase tracking-wide">or</span>
        <div class="flex-1 h-px bg-glass-border"></div>
      </div>

      <form method="POST" action="?/github" use:enhance>
        <button
          type="submit"
          class="w-full py-3 rounded-xl bg-white/5 border border-glass-border-strong hover:bg-white/8 text-text-primary text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Sign in with GitHub
        </button>
      </form>
    {/if}
  </div>
</div>
