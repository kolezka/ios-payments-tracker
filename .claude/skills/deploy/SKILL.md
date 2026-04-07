---
name: deploy
description: Verify, commit, push, and deploy to production via Coolify
disable-model-invocation: true
---

# Deploy to Production

Pre-deployment checklist and push workflow for Coolify deployment on OVH-2.

## Steps

1. **Check working tree is clean**
   ```bash
   git status --porcelain
   ```
   If dirty, ask the user whether to commit first.

2. **Verify the build works locally**
   ```bash
   cd packages/api && bun build src/index.ts --target=bun && cd ../..
   cd packages/web && bunx vite build && cd ../..
   ```

3. **Run type checks**
   ```bash
   bunx --bun svelte-kit sync && bunx svelte-check --tsconfig packages/web/tsconfig.json
   ```

4. **Push to main**
   ```bash
   git push origin main
   ```
   Coolify auto-deploys on push to main.

5. **Report** the push and remind the user to check deployment status in Coolify dashboard.

## Production URLs
- Web: https://fns.raqz.link
- API: configured via SERVICE_URL_API in Coolify
