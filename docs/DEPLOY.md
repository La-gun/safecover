# Deploy SafeCover (hosted prototype)

The repo is set up so **one URL** serves both the **REST API** and **static demos** (checkout UX, widget, etc.). The Express app already serves `frontend/` from the same origin, so demos that use `window.location.origin` as the API base work without extra configuration.

## Docker (recommended)

From the **repository root** (where `Dockerfile` lives):

```bash
docker build -t safecover .
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e SAFECOVER_STRICT=false \
  safecover
```

Open `http://localhost:3000` (redirects to the checkout demo).

### Stricter public demo (`NODE_ENV=production` defaults)

If you omit `SAFECOVER_STRICT=false`, production mode enforces API key, quote signing, CORS allowlist, etc. Set at least:

| Variable | Purpose |
|----------|---------|
| `API_KEY` | Required in strict/production; callers can still use `X-API-Key: demo` if you rely on the built-in demo key (you must set `API_KEY` to any non-empty secret per startup validation). |
| `QUOTE_SIGNING_SECRET` | Strong random string. |
| `ALLOWED_ORIGINS` | Comma-separated browser origins, e.g. `https://your-service.onrender.com`. |
| `WEBHOOK_SECRET` | If you verify webhooks. |

Optional: `BASE_URL=https://your-domain.com` if you ever need absolute URLs without a request context.

### SQLite and persistence

The API uses SQLite under `data/` when `better-sqlite3` is available. Container filesystems are often **ephemeral**: policies may reset when the instance restarts. For a prototype that is usually acceptable. For durable SQLite, mount a volume at `/app/backend/data` (or your host’s equivalent).

## Platform examples

General pattern: **Web service** from this repo’s **Dockerfile**, set `PORT` if the platform injects it (the app reads `process.env.PORT`).

- **Render**: New → Web Service → connect repo → Environment `Docker`, add env vars as needed. Use `/health` for health checks if offered.
- **Railway**: New project → deploy from repo → Dockerfile autodetected.
- **Fly.io**: `fly launch` in the repo root (adjust `fly.toml` if generated) and set secrets/env.

After deploy, share **`https://<your-host>/`** for the landing redirect, or **`/checkout-ux-demo.html`** directly.

## Troubleshooting

- **Certificate or redirect links show `http://`**: Ensure the platform sits behind HTTPS and `NODE_ENV=production` so `trust proxy` is enabled (or set `TRUST_PROXY=0` only if you must disable it).
- **CORS errors in the browser**: Add your site origin to `ALLOWED_ORIGINS` in strict mode, or use same-origin hosting (this Docker setup).
