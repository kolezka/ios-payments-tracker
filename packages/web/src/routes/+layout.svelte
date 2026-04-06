<script>
  import "../app.css";
  import Navbar from "$lib/components/Navbar.svelte";

  let { children, data } = $props();
</script>

<Navbar user={data?.user ?? null} />
{@render children()}
