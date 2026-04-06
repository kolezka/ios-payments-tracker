<script lang="ts">
  let { data }: { data: any } = $props();
</script>
<div class="fixed inset-0 bg-ambient -z-10"></div>
<div class="min-h-screen flex items-center justify-center px-4">
  <div class="glass-strong p-8 max-w-sm w-full text-center">
    {#if data.error}
      <p class="text-red-300 text-lg font-semibold mb-2">Authentication failed</p>
      <p class="text-text-secondary text-sm mb-4">{data.error}</p>
      <a href="/login" class="text-accent text-sm hover:underline">Back to login</a>
    {:else}
      <p class="text-text-secondary text-sm">Authenticating with GitHub...</p>
    {/if}
  </div>
</div>
