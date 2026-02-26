# 📂 LeadIntel AI — Complete Codebase Reference

> Every file and folder in the project, explained briefly. Use this as a map when navigating or onboarding.

---

## 📁 Root — `leadgen_0/`

| Item | Type | Purpose |
|---|---|---|
| `main.py` | File | **Entire FastAPI backend** — env loading, DB models, helper functions, all API routes |
| `migrate.py` | File | **One-time DB migration** — safely adds new columns and indexes to existing tables |
| `requirements.txt` | File | **Python dependencies** for Render deployment (`pip install -r requirements.txt`) |
| `.env` | File | **Secret keys** (never committed) — `GEMINI_API_KEY`, `APIFY_API_TOKEN`, `DATABASE_URL`, `FRONTEND_URL` |
| `.env.example` | File | **Template** for `.env` — safe to commit, shows required variable names |
| `.gitignore` | File | **Git exclusions** — ignores `.env`, `venv/`, `__pycache__/`, `.vscode/`, OS files |
| `README.md` | File | **Project overview** — setup guide, API docs, DB schema, deployment summary |
| `DEPLOYMENT.md` | File | **Deployment guide** — live URLs, Neon/Render/Vercel setup, redeployment steps |
| `INFRASTRUCTURE.md` | File | **Infrastructure reference** — service limits, CORS config, DB schema, API endpoint list |
| `WORKFLOW.md` | File | **Technical deep-dive** — architecture diagram, data flow, design decisions |
| `CODEBASE.md` | File | **This file** — every file and folder briefly documented |
| `frontend/` | Folder | React + Vite frontend application |
| `venv/` | Folder | Python virtual environment (gitignored, not committed) |
| `__pycache__/` | Folder | Python bytecode cache (gitignored, auto-generated) |
| `.git/` | Folder | Git version history (managed by Git, do not edit manually) |
| `.vscode/` | Folder | VS Code editor settings (gitignored) |

---

## 📄 Root Files — Detailed

### `main.py` — Backend (FastAPI) · ~580 lines

The entire Python backend in one file.

**Sections:**
| Lines | What it does |
|---|---|
| 1–48 | Imports, load `.env`, create Gemini client (`gemini-2.0-flash`, `v1beta`) |
| 50–89 | SQLAlchemy ORM models: `Lead` table, `SearchHistory` table; `create_all()` on startup |
| 91–111 | FastAPI app + CORS middleware — allows `localhost:5173`, `FRONTEND_URL`, and `*.vercel.app` via regex |
| 112–125 | Pydantic request models: `SearchRequest`, `EmailRequest`, `LeadUpdateRequest` |
| 130–156 | `gemini_generate()` — calls Gemini, retries once on 429 with parsed `retryDelay` |
| 159–186 | `build_google_query_fallback()` / `build_google_query()` — NL → Google search string |
| 189–238 | `fetch_leads_from_apify()` — POSTs to Apify Google Search Scraper, parses LinkedIn results |
| 241–279 | `store_leads()` — inserts leads, skips duplicates by email **or** linkedin_url |
| 282–296 | `log_search()` — inserts into `search_history` table |
| 303–320 | `POST /search-leads` — main pipeline: query → Gemini → Apify → DB → log |
| 323–382 | `GET /leads` — paginated, searchable, sortable, filterable by status |
| 385–416 | `PATCH /leads/{id}` — updates status and/or notes for a lead |
| 419–452 | `GET /search-history` — paginated list of past searches |
| 455–508 | `GET /download-leads` — streams filtered leads as CSV file |
| 511–566 | `POST /generate-email` — Gemini B2B email, fallback to template |
| 569–576 | `GET /health`, `__main__` uvicorn runner |

---

### `migrate.py` — Database Migration

Run **once** (or anytime a new column is added) to update the live DB schema without recreating tables.

**What it does:**
- `ALTER TABLE leads ADD COLUMN IF NOT EXISTS` for all columns
- Deletes duplicate `linkedin_url` rows (keeps lowest `id`) before creating unique index
- `CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_linkedin_url ON leads (linkedin_url) WHERE linkedin_url IS NOT NULL`

```bash
python migrate.py   # safe to re-run multiple times
```

---

### `requirements.txt` — Python Dependencies

Used by Render to install all packages during deployment:
```
fastapi
uvicorn[standard]
sqlalchemy
psycopg2-binary
python-dotenv
requests
google-genai
```

---

### `.env` — Environment Secrets *(gitignored)*

```env
GEMINI_API_KEY=...       # Google AI Studio key
APIFY_API_TOKEN=...      # Apify platform token
DATABASE_URL=postgresql://user:pass@host:5432/db
FRONTEND_URL=https://your-app.vercel.app
```

---

### `.env.example` — Template

Committed placeholder showing required keys with dummy values. Copy to `.env` and fill in real values.

---

### `.gitignore` — Git Exclusions

Excludes from version control:
- `.env`, `.env.*` (but allows `.env.example`)
- `venv/`, `env/`, `.venv/` — Python virtual envs
- `__pycache__/`, `*.pyc`, `*.pyo` — Python bytecode
- `dist/`, `build/`, `*.egg-info/` — build artifacts
- `.vscode/`, `.idea/` — IDE folders
- `.DS_Store`, `Thumbs.db` — OS metadata files

---

## 📁 `frontend/` — React + Vite App

| Item | Type | Purpose |
|---|---|---|
| `index.html` | File | HTML shell — sets ⚡ favicon, SEO meta, mounts `#root` div |
| `vite.config.js` | File | Vite config — enables `@vitejs/plugin-react` for JSX/HMR |
| `package.json` | File | npm manifest — dependencies, dev scripts |
| `package-lock.json` | File | Exact dependency lockfile (committed for reproducibility) |
| `vercel.json` | File | **SPA routing** — rewrites all routes to `index.html` for React Router |
| `eslint.config.js` | File | ESLint config — React hooks + refresh rules |
| `.gitignore` | File | Frontend-specific git exclusions (`node_modules/`, `dist/`) |
| `.env.production` | File | `VITE_API_BASE` pointing to Render backend (used at build time) |
| `README.md` | File | Frontend-specific dev docs |
| `src/` | Folder | All React source code |
| `public/` | Folder | Static assets served at root |
| `dist/` | Folder | Production build output (gitignored) |
| `node_modules/` | Folder | npm packages (gitignored) |

---

### `frontend/vercel.json`

SPA routing config — tells Vercel to serve `index.html` for all routes so React Router handles navigation:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Without this, direct URL access to `/leads` or `/history` would return a Vercel 404.

---

### `frontend/.env.production`

```env
VITE_API_BASE=https://leadintel-backend.onrender.com
```

Vite injects this at build time. In local dev, the default falls back to `http://localhost:8000`.

---

## 📁 `frontend/src/` — Source Code

| Item | Type | Purpose |
|---|---|---|
| `main.jsx` | File | React app entry point — mounts `<App />` into `#root` |
| `App.jsx` | File | Router layout — navbar + 3 page routes (Search, Leads, History) |
| `App.css` | File | Vite scaffold CSS (mostly unused) |
| `index.css` | File | **Full design system** — all styles for the entire app |
| `api.js` | File | **API layer** — all fetch calls to the FastAPI backend |
| `components/` | Folder | Shared UI components |
| `pages/` | Folder | Page-level components (one per route) |
| `assets/` | Folder | Static assets |

---

### `frontend/src/App.jsx` · Routes

| Route | Component | Description |
|---|---|---|
| `/` | `SearchPage` | Natural language search & recent queries |
| `/leads` | `LeadsPage` | Leads dashboard with filters |
| `/history` | `HistoryPage` | Search history with Re-run |

---

### `frontend/src/api.js`

Centralised API layer — base URL from `VITE_API_BASE` env var.

| Export | HTTP | Endpoint |
|---|---|---|
| `searchLeads(query)` | POST | `/search-leads` |
| `getLeads({ page, limit, search, status, sort_by, order })` | GET | `/leads` |
| `updateLead(id, { status, notes })` | PATCH | `/leads/{id}` |
| `getSearchHistory({ page, limit, order })` | GET | `/search-history` |
| `generateEmail(lead)` | POST | `/generate-email` |
| `downloadLeadsUrl(params)` | — | Returns filtered CSV URL |

---

## 📁 `frontend/src/components/`

### `SearchBar.jsx`
- 4 example hint chips (clickable, auto-submits)
- Submit on Enter or button click
- Inline spinner inside button while loading

### `LeadsTable.jsx`
Complex component with sub-components:
- `EmailModal` — fetches AI email on open; Copy button
- `StatusCell` — colour-coded badge + invisible `<select>` overlay; calls `updateLead` on change
- `NotesCell` — click to edit textarea; blur to auto-save

### `Loader.jsx`
Minimal spinner. Prop: `text` (default: `"Loading…"`)

### `Toast.jsx`
- `useToast()` hook — initialises state
- `toast(message, type)` — callable from anywhere (modules, not just React)
- `ToastContainer` — fixed bottom-right; auto-removes after 3.5s
- Types: `"success"` · `"error"` · `"info"`

---

## 📁 `frontend/src/pages/`

### `SearchPage.jsx` — `/`
- Hero title, subtitle, feature pill list
- `<SearchBar>` with query handling
- Recent searches saved in `localStorage` (key: `leadintel_recent_searches`, max 5)
- Result banner showing `leads_scraped`, `leads_stored`, `google_query`

### `LeadsPage.jsx` — `/leads`
- Stats row: Total Leads / This Page / Total Pages / Current Page
- Filter bar: text search, status dropdown, sort dropdown
- CSV download matches current filter state

### `HistoryPage.jsx` — `/history`
- Search history table: Query · Generated Query · Results · Date · Action
- Re-run button per row — calls `searchLeads()` then navigates to `/leads`
- Full pagination

---

## 🗃️ Database Tables (PostgreSQL on Neon)

### `leads`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK, auto-increment |
| `name` | VARCHAR | — |
| `email` | VARCHAR | Unique (when not null) |
| `company` | VARCHAR | — |
| `job_title` | VARCHAR | — |
| `location` | VARCHAR | — |
| `industry` | VARCHAR | Nullable |
| `linkedin_url` | VARCHAR | Unique index (non-null only) |
| `status` | VARCHAR | Default `'New'` |
| `notes` | TEXT | Nullable |
| `created_at` | TIMESTAMP | Default `NOW()` |

### `search_history`

| Column | Type |
|---|---|
| `id` | INTEGER PK |
| `user_query` | TEXT |
| `filters_generated` | TEXT |
| `total_results` | INTEGER |
| `created_at` | TIMESTAMP |

---

## 🛠️ Running Locally

```bash
# Terminal 1 — Backend
cd leadgen_0
venv\Scripts\activate
uvicorn main:app --reload
# → http://127.0.0.1:8000
# → http://127.0.0.1:8000/docs  (Swagger UI)

# Terminal 2 — Frontend
cd leadgen_0/frontend
npm run dev
# → http://localhost:5173

# One-time — DB migration
python migrate.py
```
