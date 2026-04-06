<script lang="ts">
  import { enhance } from "$app/forms";
  let { form }: { form: any } = $props();
</script>
<div class="fixed inset-0 bg-ambient -z-10"></div>
<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <h1 class="text-2xl font-bold text-text-primary tracking-tight mb-1">Welcome!</h1>
    <p class="text-sm text-text-secondary mb-8">What should we call you?</p>
    {#if form?.error}
      <div class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 mb-4 text-sm text-red-300">{form.error}</div>
    {/if}
    <form method="POST" use:enhance>
      <input type="text" name="name" placeholder="Your name" required autofocus
        class="w-full px-4 py-3 rounded-xl bg-glass-bg border border-glass-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 mb-3 font-sans" />
      <button type="submit"
        class="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors cursor-pointer">
        Continue
      </button>
    </form>
  </div>
</div>
