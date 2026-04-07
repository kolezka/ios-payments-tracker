<script lang="ts">
  import { enhance } from "$app/forms";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/stores";

  let { user }: { user: { name: string; email: string } | null } = $props();
  let dropdownOpen = $state(false);

  afterNavigate(() => { dropdownOpen = false; });

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
  <div class="sticky top-0 z-50 px-5 py-3" style="background: linear-gradient(180deg, rgba(8,10,16,0.95) 0%, rgba(8,10,16,0.6) 70%, transparent 100%);">
    <nav class="glass-strong flex items-center justify-between max-w-[calc(56rem-2.5rem)] mx-auto px-4 py-2 relative">
      <!-- Logo + Brand -->
      <a href="/" class="flex items-center gap-2.5 group">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center group-hover:from-indigo-500/30 group-hover:to-purple-500/30 transition-all">
          <svg class="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z"/>
            <path d="M1 10h22"/>
            <path d="M6 15h2"/>
            <path d="M12 15h6"/>
          </svg>
        </div>
        <span class="text-sm font-semibold text-text-primary tracking-tight hidden sm:block">Payment Tracker</span>
      </a>

      <!-- Nav links (desktop, centered) -->
      <div class="hidden sm:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
        <a href="/" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {$page.url.pathname === '/' ? 'text-accent bg-indigo-500/10' : 'text-text-muted hover:text-text-secondary'}">
          Dashboard
        </a>
        <a href="/setup" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {$page.url.pathname === '/setup' ? 'text-accent bg-indigo-500/10' : 'text-text-muted hover:text-text-secondary'}">
          Shortcut
        </a>
        <a href="/export" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {$page.url.pathname === '/export' ? 'text-accent bg-indigo-500/10' : 'text-text-muted hover:text-text-secondary'}">
          Export
        </a>
        <a href="/settings" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {$page.url.pathname === '/settings' ? 'text-accent bg-indigo-500/10' : 'text-text-muted hover:text-text-secondary'}">
          Webhooks
        </a>
      </div>

      <!-- User menu -->
      <div class="nav-dropdown-area relative">
        <button
          onclick={() => dropdownOpen = !dropdownOpen}
          class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-500/40 border-[1.5px] border-white/10 flex items-center justify-center text-xs text-indigo-200 font-semibold cursor-pointer hover:border-white/20 hover:shadow-[0_0_16px_rgba(99,102,241,0.2)] transition-all duration-200 relative"
        >
          {initials(user.name || user.email)}
          <span class="absolute -bottom-px -right-px w-2 h-2 rounded-full bg-green-500 border-[1.5px] border-bg-base"></span>
        </button>

        {#if dropdownOpen}
          <div
            class="absolute right-0 top-12 min-w-[200px] py-2 z-50 rounded-xl overflow-hidden border border-glass-border-strong shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
            style="background: rgba(12, 14, 24, 0.97); backdrop-filter: blur(24px) saturate(1.4); animation: dropdown-in 150ms ease-out;"
          >
            <div class="px-4 py-3 border-b border-glass-border">
              <div class="text-sm text-text-primary font-medium truncate">{user.name || 'User'}</div>
              <div class="text-xs text-text-dim truncate mt-0.5">{user.email}</div>
            </div>

            <!-- Mobile nav links -->
            <div class="sm:hidden border-b border-glass-border py-1">
              <a href="/" class="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-accent hover:bg-white/5 transition-colors">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                Dashboard
              </a>
              <a href="/setup" class="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-accent hover:bg-white/5 transition-colors">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                Shortcut Setup
              </a>
              <a href="/export" class="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-accent hover:bg-white/5 transition-colors">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </a>
              <a href="/settings" class="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-accent hover:bg-white/5 transition-colors">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                Webhooks
              </a>
            </div>

            <div class="py-1">
              <form method="POST" action="/login?/logout" use:enhance>
                <button type="submit" class="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm text-text-secondary hover:text-red-300 hover:bg-red-500/5 transition-colors cursor-pointer">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Logout
                </button>
              </form>
            </div>
          </div>
        {/if}
      </div>
    </nav>
  </div>
{/if}

<style>
  @keyframes dropdown-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
