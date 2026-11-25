# FactuSYS — agent notes

## Architecture
- Django 5.1 REST API (`backend/`: `config/settings.py`, `config/urls.py`) + React 19 / Vite SPA (`frontend/`: `src/App.tsx` routes, `src/services/api.ts` Axios client). PostgreSQL 16, Nginx and supercronic run via Compose; every API route is mounted under `/api/<app>/` (Swagger at `/api/docs/`).
- Business apps are `backend/apps/*`. Invoice creation lives in `apps/facturacion/services.py` (FIFO lot stock, timbrado, credit/cuotas), not in views. `AppConfig.ready()` imports `signals.py` for compras, facturacion, logistica and presupuestos, so model saves can trigger stock/audit side effects.
- SIFEN/e-kuatia code was removed (commit `996ee3b`); XSD/PDF files in `DOCS/` are historical references, not a live integration.
- Planned rewrite to Supabase Auth/PostgREST/RLS + Vercel SPA: `DOCS/PLAN_MIGRACION_SUPABASE_VERCEL.md` (proposal only; no app code changed yet).

## Setup & run
- Bootstrap with `./setup.sh` or `.\setup.ps1` (generates `.env`, builds, starts services; `-NoBuild` skips the build on PowerShell). `.env` is gitignored and effectively mandatory: `settings.py` reads `SECRET_KEY` via `os.environ[...]` and defaults `DB_HOST` to the Compose service name `db`, so bare host-side `manage.py` runs need `SECRET_KEY` and `DB_HOST=localhost`.
- Production-like: `docker compose up -d --build`. Dev with Vite HMR + Django debug: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build` (Vite 5173, API 8000).
- `backend/entrypoint.sh` runs `migrate`, `collectstatic --clear` and `initadmin` on every backend start. `initadmin` creates `admin` / `admin123` if no superuser exists — change it on any real deployment.
- Scheduled jobs are in `backend/crontab` (supercronic in the `backup` service): DB backup at 03:00 and `mark_overdue_cuotas` hourly. `cloud_sync/README.txt` says "midnight"; the crontab is authoritative.

## Verification
- Backend tests: from `backend/`, run `DJANGO_SETTINGS_MODULE=config.test_settings python manage.py test` (211 tests, ~2 min, in-memory SQLite). Focused: `python manage.py test apps.facturacion`. `config/test_settings.py` and `config/test_urls.py` intentionally differ from prod (no PostgreSQL, guardian or spectacular); don't assume parity.
- `pytest` is pinned in `requirements.txt` but has no config: its default collection misses `apps/*/tests.py` and tries to import `config/test_urls.py`. Use Django's test runner.
- Frontend: `npm ci && npm run build` in `frontend/` (`tsc && vite build`); there is no test or lint script. No CI, pre-commit, linter or formatter config exists in this repo.

## Gotchas
- `VITE_API_URL` is baked at build time (`ARG` in `frontend/Dockerfile`, `/api` in Compose). The Vite dev proxy targets the Docker hostname `http://backend:8000`, so a host-run `npm run dev` needs `VITE_API_URL=http://localhost:8000/api`; changing the production API URL requires a rebuild.
- Defaults are `es-PY`, `America/Asuncion`, IVA 10%, PYG; `.env.example` sets `ALLOWED_HOSTS=*`, and `CORS_ALLOW_ALL_ORIGINS` follows `DEBUG`.
- `productos` has two chained `0002_*` migrations (`...cantidad_stock` then `...unidad_medida`); don't regenerate or squash them casually.
