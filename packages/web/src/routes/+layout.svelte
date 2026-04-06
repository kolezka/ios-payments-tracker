<script lang="ts">
  import "../app.css";
  import Navbar from "$lib/components/Navbar.svelte";
  import type { Snippet } from "svelte";

  let { children, data }: { children: Snippet; data: { user?: { name: string; email: string } | null } } = $props();
</script>

<Navbar user={data?.user ?? null} />
{@render children()}
