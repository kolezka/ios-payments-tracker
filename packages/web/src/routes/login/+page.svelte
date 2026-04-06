<script lang="ts">
  import { enhance } from "$app/forms";

  let { form }: { form: any } = $props();
</script>

<div class="container">
  <div class="login-box">
    <h1>$ payment-tracker</h1>
    <p class="subtitle">authenticate to continue</p>

    {#if form?.error}
      <div class="error">{form.error}</div>
    {/if}

    <form method="POST" action="?/login" use:enhance>
      <input
        type="password"
        name="token"
        placeholder="enter access token"
        autocomplete="off"
        required
      />
      <button type="submit">login</button>
    </form>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #0a0a0a;
    color: #e0e0e0;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  }

  .container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .login-box {
    width: 100%;
    max-width: 400px;
    padding: 2rem;
  }

  h1 {
    color: #00ff88;
    font-size: 1.5rem;
    margin: 0 0 0.5rem;
  }

  .subtitle {
    color: #666;
    margin: 0 0 2rem;
    font-size: 0.875rem;
  }

  .error {
    background: #ff000020;
    border: 1px solid #ff0000;
    color: #ff6666;
    padding: 0.75rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    background: #1a1a1a;
    border: 1px solid #333;
    color: #e0e0e0;
    font-family: inherit;
    font-size: 0.875rem;
    margin-bottom: 1rem;
    box-sizing: border-box;
  }

  input:focus {
    outline: none;
    border-color: #00ff88;
  }

  button {
    width: 100%;
    padding: 0.75rem;
    background: #00ff88;
    color: #0a0a0a;
    border: none;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: bold;
    cursor: pointer;
  }

  button:hover {
    background: #00cc6a;
  }
</style>
