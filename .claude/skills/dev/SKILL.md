---
name: dev
description: Start local development environment (API + web) with health checks
disable-model-invocation: true
---

# Start Development Environment

Launch the full local stack with DEV_MODE enabled (auto-authentication, no login required).

## Steps

1. **Kill stale processes** on ports 3000, 5173, 5174
   ```bash
   lsof -ti:3000,5173,5174 | xargs kill 2>/dev/null || true
   ```

2. **Start API server** (background)
   ```bash
   DEV_MODE=true bun --hot packages/api/src/index.ts &
   ```

3. **Start web server** (background)
   ```bash
   cd packages/web && DEV_MODE=true API_URL=http://localhost:3000 bunx vite dev &
   ```

4. **Wait for health** and verify both services are up
   ```bash
   # API health
   curl -s --retry 5 --retry-delay 1 http://localhost:3000/health
   # Web
   curl -s -o /dev/null -w "%{http_code}" --retry 5 --retry-delay 1 http://localhost:5173/
   ```

5. **Report** the URLs:
   - Web: http://localhost:5173
   - API: http://localhost:3000

## Environment
- `DEV_MODE=true` — auto-authenticates with dev@local user
- `API_URL=http://localhost:3000` — web connects to local API
