# Deployment

## Frontend (static)

```bash
cd frontend
npm ci
npm run build                     # dist/ — needs a server that rewrites unknown paths to index.html
# or a fully static, offline build with hash routing (any static host, no rewrites, no API):
npm run build:demo                # VITE_ROUTER=hash VITE_OFFLINE=1, relative base
```

Environment variables (build time):

| Variable          | Default     | Purpose                                                                                                                                                                                                                                                           |
| ----------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE`   | `/api`      | Base URL of the content API                                                                                                                                                                                                                                       |
| `VITE_ROUTER`     | `browser`   | `hash` for hosts without SPA rewrites                                                                                                                                                                                                                             |
| `VITE_OFFLINE`    | unset       | `1` skips API checks entirely                                                                                                                                                                                                                                     |
| `VITE_MODEL_FILE` | `brain.glb` | Model file under `models/`. A name ending in `.json` loads `{"glb": "<base64>"}` and parses it locally, for hosts that refuse binary files (used for the claude.ai demo, with a meshopt-free `gltf-transform quantize` build so no WebAssembly decoder is needed) |

Serve `dist/` behind any static server/CDN. Set long cache lifetimes for `assets/*` and `models/brain.glb` (content-hashed JS; re-deploy the GLB with a new name if the model changes). Proxy `/api` to the backend, or set `VITE_API_BASE` to its absolute URL and add the frontend origin to `CORS_ORIGINS`.

## Backend

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

| Variable                  | Default                         | Purpose                                                                                                |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`            | `sqlite:///./neurosphere.db`    | Any SQLAlchemy URL, e.g. `postgresql+psycopg://user:pass@host/neurosphere` (install `psycopg[binary]`) |
| `CORS_ORIGINS`            | localhost dev ports             | Comma-separated allowed origins                                                                        |
| `NEUROSPHERE_CONTENT_DIR` | `../content`                    | Location of the validated content JSON                                                                 |
| `NEUROSPHERE_MANIFEST`    | `../assets/model-manifest.json` | Model manifest (geometry metadata)                                                                     |

The schema is created and seeded on startup; it re-seeds only when the content hash changes. The API is read-only (GET) and holds no secrets.

> PostgreSQL compatibility follows from using only portable SQLAlchemy types (JSON columns, no SQLite-specific SQL), but it has **not** been exercised against a live PostgreSQL server in this build. Test before production use.

## Pre-release checklist

```bash
make validate     # model + content validators
make test         # typecheck, Vitest, pytest
make lint         # ESLint + Ruff
make test-e2e     # production build + Playwright acceptance tests
```

CI (`.github/workflows/ci.yml`) runs everything except the browser tests on every push.
