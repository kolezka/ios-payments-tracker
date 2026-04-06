<script lang="ts">
  import { enhance } from "$app/forms";

  let { user }: { user: { name: string; email: string } | null } = $props();
  let dropdownOpen = $state(false);

  function initials(name: string): string {
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".nav-dropdown-area")) {
      dropdownOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

{#if user}
  <div class="sticky top-0 z-50 flex justify-center px-5 py-4" style="background: linear-gradient(180deg, rgba(8,10,16,0.9) 0%, transparent 100%);">
    <nav class="flex items-center justify-end w-full max-w-[800px]">
      <div class="nav-dropdown-area relative">
        <button
          onclick={() => dropdownOpen = !dropdownOpen}
          class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-500/40 border-[1.5px] border-white/10 flex items-center justify-center text-xs text-indigo-200 font-semibold cursor-pointer hover:border-white/20 hover:shadow-[0_0_16px_rgba(99,102,241,0.2)] transition-all relative"
        >
          {initials(user.name || user.email)}
          <span class="absolute -bottom-px -right-px w-2 h-2 rounded-full bg-green-500 border-[1.5px] border-bg-base"></span>
        </button>

        {#if dropdownOpen}
          <div class="absolute right-0 top-11 glass-strong min-w-[180px] py-1.5 z-50 rounded-xl overflow-hidden">
            <div class="px-4 py-2 border-b border-glass-border">
              <div class="text-sm text-text-primary font-medium truncate">{user.name || 'User'}</div>
              <div class="text-xs text-text-dim truncate">{user.email}</div>
            </div>
            <a href="/setup" class="block px-4 py-2 text-sm text-text-secondary hover:text-accent hover:bg-white/5 transition-colors">
              Shortcut Setup
            </a>
            <a href="/settings" class="block px-4 py-2 text-sm text-text-secondary hover:text-accent hover:bg-white/5 transition-colors">
              Settings
            </a>
            <form method="POST" action="/login?/logout" use:enhance>
              <button type="submit" class="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-red-300 hover:bg-white/5 transition-colors cursor-pointer">
                Logout
              </button>
            </form>
          </div>
        {/if}
      </div>
    </nav>
  </div>
{/if}
