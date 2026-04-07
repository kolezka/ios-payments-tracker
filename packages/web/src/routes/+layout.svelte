<script lang="ts">
  import "../app.css";
  import { onNavigate } from "$app/navigation";
  import Navbar from "$lib/components/Navbar.svelte";
  import type { Snippet } from "svelte";

  let { children, data }: { children: Snippet; data: { user?: { name: string; email: string } | null } } = $props();

  onNavigate((navigation) => {
    if (!document.startViewTransition) return;
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<Navbar user={data?.user ?? null} />
{@render children()}
