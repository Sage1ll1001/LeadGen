# 📂 LeadIntel AI — Complete Codebase Reference

> Every file and folder in the project, explained briefly. Use this as a map when navigating or onboarding.

---

## 📁 Root — `leadgen_0/`

| Item | Type | Purpose |
|---|---|---|
| `main.py` | File | **Entire FastAPI backend** — env loading, DB models, helper functions, all API routes |
| `migrate.py` | File | **One-time DB migration** — safely adds new columns and indexes to existing tables |
| `.env` | File | **Secret keys** (never committed) — `GEMINI_API_KEY`, `APIFY_API_TOKEN`, `DATABASE_URL` |
| `.env.example` | File | **Template** for `.env` — safe to commit, shows required variable names with dummy values |
| `.gitignore` | File | **Git exclusions** — ignores `.env`, `venv/`, `__pycache__/`, `.vscode/`, OS files |
| `README.md` | File | **Project overview** — setup guide, API docs, DB schema, deployment instructions |
| `WORKFLOW.md` | File | **Technical deep-dive** — architecture diagram, data flow, file-by-file breakdown, design decisions |
| `CODEBASE.md` | File | **This file** — every file and folder briefly documented |
| `frontend/` | Folder | React + Vite frontend application |
| `venv/` | Folder | Python virtual environment (gitignored, not committed) |
| `__pycache__/` | Folder | Python bytecode cache (gitignored, auto-generated) |
| `.git/` | Folder | Git version history (managed by Git, do not edit manually) |
| `.vscode/` | Folder | VS Code editor settings (gitignored) |

---

## 📄 Root Files — Detailed

### `main.py` — Backend (FastAPI) · 572 lines

The entire Python backend in one file.

**Sections:**
| Lines | What it does |
|---|---|
| 1–48 | Imports, load `.env`, create Gemini client (`gemini-2.0-flash`, `v1beta`) |
| 50–89 | SQLAlchemy ORM models: `Lead` table, `SearchHistory` table; `create_all()` on startup |
| 91–102 | FastAPI app + CORS middleware (allows `localhost:5173`) |
| 104–120 | Pydantic request models: `SearchRequest`, `EmailRequest`, `LeadUpdateRequest` |
| 122–151 | `gemini_generate()` — calls Gemini, retries once on 429 with parsed `retryDelay` |
| 153–181 | `build_google_query_fallback()` — rule-based keyword query when Gemini is unavailable |
| 163–181 | `build_google_query()` — tries Gemini first, falls back to rule-based |
| 184–233 | `fetch_leads_from_apify()` — POSTs to Apify Google Search Scraper, parses LinkedIn results |
| 236–274 | `store_leads()` — inserts leads, skips duplicates by email or linkedin_url |
| 277–291 | `log_search()` — inserts into `search_history` table |
| 298–315 | `POST /search-leads` — main pipeline: query → Gemini → Apify → DB → log |
| 318–377 | `GET /leads` — paginated, searchable, sortable, filterable by status |
| 380–411 | `PATCH /leads/{id}` — updates status and/or notes for a lead |
| 414–447 | `GET /search-history` — paginated list of past searches |
| 450–503 | `GET /download-leads` — streams filtered leads as CSV file |
| 506–561 | `POST /generate-email` — Gemini B2B email, fallback to template |
| 564–571 | `GET /health`, `__main__` uvicorn runner |

---

### `migrate.py` — Database Migration · 56 lines

Run **once** (or anytime a new column is added) to update the live DB schema without recreating tables.

**What it does:**
- `ALTER TABLE leads ADD COLUMN IF NOT EXISTS` for: `job_title`, `location`, `industry`, `linkedin_url`, `email`, `company`, `created_at`, `status`, `notes`
- Deletes duplicate `linkedin_url` rows (keeps lowest `id`) before creating unique index
- `CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_linkedin_url ON leads (linkedin_url) WHERE linkedin_url IS NOT NULL`
- Prints final `leads` table schema after migration

```bash
python migrate.py   # safe to re-run multiple times
```

---

### `.env` — Environment Secrets *(gitignored)*

```env
GEMINI_API_KEY=...       # Google AI Studio key
APIFY_API_TOKEN=...      # Apify platform token
DATABASE_URL=postgresql://user:pass@host:5432/db
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

### `README.md` — Project Overview

User-facing documentation covering: overview, project structure, tech stack, environment setup, getting started, API endpoint reference, Gemini fallback table, DB schema, development notes, deployment guide.

---

### `WORKFLOW.md` — Technical Deep-Dive (460 lines)

Developer-focused internal doc covering: high-level architecture diagram, data flow, every section of `main.py` explained, all API endpoints with request/response shapes, full end-to-end scenarios, key design decisions table, known bugs and fixes.

---

## 📁 `frontend/` — React + Vite App

| Item | Type | Purpose |
|---|---|---|
| `index.html` | File | HTML shell — sets ⚡ favicon, SEO meta, mounts `#root` div |
| `vite.config.js` | File | Vite config — enables `@vitejs/plugin-react` for JSX/HMR |
| `package.json` | File | npm manifest — dependencies, dev scripts |
| `package-lock.json` | File | Exact dependency lockfile (committed for reproducibility) |
| `eslint.config.js` | File | ESLint config — React hooks + refresh rules |
| `.gitignore` | File | Frontend-specific git exclusions (`node_modules/`, `dist/`) |
| `README.md` | File | Vite default readme (not project docs) |
| `src/` | Folder | All React source code |
| `public/` | Folder | Static assets served at root (e.g., `vite.svg`) |
| `dist/` | Folder | Production build output (generated by `npm run build`, gitignored) |
| `node_modules/` | Folder | npm packages (gitignored, restored by `npm install`) |

---

### `frontend/index.html` · 15 lines

The single HTML page. Includes:
- `⚡` emoji as SVG favicon
- SEO meta description tag
- `<div id="root">` mount point
- `<script type="module" src="/src/main.jsx">` — Vite entry point

---

### `frontend/vite.config.js` · 8 lines

Minimal Vite config — only applies `@vitejs/plugin-react` plugin (enables JSX fast refresh in dev mode and production optimisations).

---

### `frontend/package.json` · 30 lines

| Section | Contents |
|---|---|
| **Scripts** | `dev` (Vite dev server), `build` (prod bundle), `lint` (ESLint), `preview` |
| **Dependencies** | `react ^19`, `react-dom ^19`, `react-router-dom ^7`, `axios ^1` |
| **DevDependencies** | `vite ^7`, `@vitejs/plugin-react`, `eslint ^9`, react-hooks + react-refresh eslint plugins |

---

### `frontend/eslint.config.js`

ESLint flat-config setup for React 19 projects. Enforces:
- `eslint-plugin-react-hooks` rules (correct `useEffect` dependency arrays, etc.)
- `eslint-plugin-react-refresh` (warns about non-component exports in HMR files)

---

## 📁 `frontend/src/` — Source Code

| Item | Type | Purpose |
|---|---|---|
| `main.jsx` | File | React app entry point — mounts `<App />` into `#root` |
| `App.jsx` | File | Router layout — navbar + 3 page routes |
| `App.css` | File | Vite default CSS (mostly unused — real styles are in `index.css`) |
| `index.css` | File | **Full design system** — all styles for the entire app |
| `api.js` | File | **API layer** — all fetch calls to the FastAPI backend |
| `components/` | Folder | Shared UI components |
| `pages/` | Folder | Page-level components (one per route) |
| `assets/` | Folder | Static assets (e.g., `react.svg`, Vite default) |

---

### `frontend/src/main.jsx` · 11 lines

```jsx
createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)
```
React 19 entry point. Wraps in `StrictMode` for development double-renders and extra checks.

---

### `frontend/src/App.jsx` · 51 lines

Sets up the app shell:
- `<BrowserRouter>` — client-side routing
- `<nav>` — sticky top navbar with brand logo and 3 `<NavLink>` items
- `<Routes>` — maps URLs to page components:

| Route | Component |
|---|---|
| `/` | `SearchPage` |
| `/leads` | `LeadsPage` |
| `/history` | `HistoryPage` |

- `<ToastContainer>` — global notification overlay

---

### `frontend/src/App.css` · 43 lines

Vite scaffold CSS — defines `#root` max-width, default logo animations, card padding. **Not actively used** in this app (the design system lives in `index.css`).

---

### `frontend/src/index.css` · ~900 lines

The **entire visual design system**. Sections:

| Section | What it covers |
|---|---|
| Design Tokens (`:root`) | CSS variables: colours, gradients, spacing, shadows, transitions |
| Reset | Box-sizing, colour-scheme dark, body font/bg |
| Scrollbar | Custom thin dark scrollbar |
| Layout | `.app-layout` flex column |
| Navbar | Sticky glassmorphism nav bar with brand + links |
| Hero / Search Page | Centred hero layout with radial gradient glow |
| Search Bar | Pill-shaped search input with focus glow ring |
| Hint Chips | Clickable example query pills |
| Leads Page | Page header, stats row, filter bar |
| Buttons | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-sm` |
| Table | Dark-themed sortable table with hover rows |
| Pagination | Page number buttons with active state |
| Modal | Email overlay with backdrop blur + slide-up animation |
| Loader | Spinning circle animation |
| Toast | Fixed bottom-right notifications (success/error/info) |
| Result Banner | Post-search stats card |
| Stats Row | 4-column stat card grid with gradient numbers |
| **Status Badges** | `.status-new` (blue), `.status-contacted` (yellow), `.status-qualified` (green), `.status-rejected` (red) |
| **Status Cell** | Transparent select overlay on badge for click-to-change |
| **Notes Cell** | Click-to-edit inline textarea for lead notes |
| **Recent Searches** | Pill buttons for previous queries below search bar |
| Animations | `spin`, `fadeIn`, `slideUp`, `slideInRight` keyframes |
| Responsive | 768px breakpoint overrides |

---

### `frontend/src/api.js` · 54 lines

Centralised API layer — all calls go through here so the base URL is in one place.

| Export | HTTP | Endpoint | Description |
|---|---|---|---|
| `searchLeads(query)` | POST | `/search-leads` | Run NL search, returns `{ google_query, leads_scraped, leads_stored }` |
| `getLeads({ page, limit, search, sort_by, order, status })` | GET | `/leads` | Paginated lead list with filters |
| `updateLead(id, { status, notes })` | PATCH | `/leads/{id}` | Update a lead's status or notes |
| `getSearchHistory({ page, limit, order })` | GET | `/search-history` | Paginated search history |
| `generateEmail(lead)` | POST | `/generate-email` | AI-generated outreach email |
| `downloadLeadsUrl({ search, status, sort_by, order })` | — | `/download-leads` | Returns filtered CSV download URL |

---

## 📁 `frontend/src/components/` — Reusable Components

### `SearchBar.jsx` · 69 lines

Natural language search input component.

- Shows 4 example hint chips: `CEOs in Mumbai`, `Software Engineers at Google`, `VPs of Marketing in Bangalore`, `Founders in Delhi`
- Clicking a hint fills the input AND auto-submits
- Submit on Enter key or `⚡ Find Leads` button click
- Shows inline spinner inside the button while `loading = true`
- Props: `onSearch(query: string)`, `loading: boolean`

---

### `LeadsTable.jsx` · ~260 lines

The most complex component — the full leads table with all interactive features.

**Sub-components inside the file:**

| Sub-component | What it does |
|---|---|
| `EmailModal` | Overlay that fetches and displays an AI-generated email on mount; Copy button |
| `StatusCell` | Shows colour-coded badge + invisible `<select>` overlay; calls `updateLead` on change; reverts on error |
| `NotesCell` | Shows truncated text preview; click reveals `<textarea>`; blur saves via `updateLead`; optimistic update |

**Table columns:** Name · Company · Job Title · Location · Date · Status · Notes · Email · LinkedIn · Actions

**Features:**
- Sortable headers (click toggles asc/desc) via `onSort` callback
- Local lead state synced with parent on page change
- Pagination controls (First / Prev / numbered / Next / Last)
- Empty state illustration when no leads match filters

---

### `Loader.jsx` · 9 lines

Minimal spinner component. Renders `.loader-overlay > .spinner + .loader-text`.

- Prop: `text` (default: `"Loading…"`)
- Used on both `LeadsPage` and `HistoryPage` during data fetching

---

### `Toast.jsx` · 43 lines

Two-part notification system:

| Export | Description |
|---|---|
| `useToast()` | Hook — initialises toast state, registers global `_setToasts` ref |
| `toast(message, type)` | Imperative function — callable from anywhere (not just React components); uses module-level `_setToasts` |
| `ToastContainer` | Renders fixed bottom-right list of active toast divs (auto-removed after 3.5 s) |

Types: `"success"` (green ✓) · `"error"` (red ✕) · `"info"` (blue ℹ)

---

## 📁 `frontend/src/pages/` — Page Components

### `SearchPage.jsx` · 125 lines

The `/` home page — hero search UI.

**Features:**
- Hero title, subtitle, feature pill list
- `<SearchBar>` with query handling
- **Recent searches** — on successful search, query is saved to `localStorage` key `leadintel_recent_searches` (max 5); rendered as clickable `🕑 query` pills; clicking auto-submits the query
- Result banner after search — shows `leads_scraped`, `leads_stored`, `google_query` and a "View Dashboard →" button
- 7 feature pills at the bottom (AI Query Parsing, LinkedIn Scraping, etc.)

---

### `LeadsPage.jsx` · 128 lines

The `/leads` dashboard page.

**State:** `leads`, `total`, `page`, `pages`, `loading`, `search`, `statusFilter`, `sortBy`, `order`

**Features:**
- Stats row: Total Leads / This Page / Total Pages / Current Page
- Filter bar with 3 controls:
  - 🔍 Text search (name / company / title / location)
  - Status dropdown (All Statuses / New / Contacted / Qualified / Rejected)
  - Sort dropdown (Newest First / Oldest First / Name A–Z / etc.)
- **Filtered CSV download** — "⬇️ Download CSV" opens `downloadLeadsUrl({ search, status, sort_by, order })` so the exported file exactly matches the current view
- Passes all state to `<LeadsTable>` and `<Loader>`

---

### `HistoryPage.jsx` · 161 lines

The `/history` page — view and re-run past searches.

**State:** `history`, `total`, `page`, `pages`, `loading`, `rerunId`

**Table columns:** Query · Generated Google Query · Results · Date & Time · Action

**Features:**
- Stats row: Total Searches / This Page / Total Pages / Current Page
- ↺ Refresh button to reload
- **Re-run button** per row — calls `searchLeads(query)` and navigates to `/leads` on success; shows `"Running…"` while in-flight
- Full pagination (First / Prev / numbered / Next / Last)
- Empty state with `🕑` icon when no history exists

---

## 📁 `frontend/src/assets/`

| File | Purpose |
|---|---|
| `react.svg` | Default Vite scaffold asset (not used in production UI) |

---

## 📁 `frontend/public/`

| File | Purpose |
|---|---|
| `vite.svg` | Default Vite favicon shown during dev before `index.html` favicon loads |

---

## 📁 `venv/` *(gitignored)*

Python virtual environment. Contains:
- `Scripts/` — `python.exe`, `pip.exe`, `uvicorn.exe`, `activate` scripts
- `Lib/site-packages/` — all installed packages: `fastapi`, `uvicorn`, `sqlalchemy`, `psycopg2-binary`, `google-genai`, `python-dotenv`, `requests`, `pydantic`, etc.

Recreate with:
```bash
python -m venv venv
venv\Scripts\activate
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv requests google-genai
```

---

## 📁 `node_modules/` *(gitignored)*

All npm packages installed by `npm install`. ~500+ packages. Key ones:
- `react`, `react-dom` — React 19 core
- `react-router-dom` — client-side routing
- `axios` — HTTP client (available, api.js uses `fetch` natively)
- `vite`, `@vitejs/plugin-react` — build tooling

Recreate with: `cd frontend && npm install`

---

## 📁 `__pycache__/` *(gitignored)*

Auto-generated Python bytecode. Contains compiled `.pyc` files for `main.py`. Deleted automatically on Python version change. Safe to delete manually.

---

## 📁 `.git/` *(managed by Git)*

Git internal data store. Contains:
- `HEAD` — current branch pointer
- `objects/` — all versioned file content (blobs, trees, commits)
- `refs/` — branch and tag pointers
- `config` — repo config (remote URL, user, etc.)
- `COMMIT_EDITMSG` — last commit message

> ⚠️ Never edit manually. Use `git` commands only.

---

## 📁 `.vscode/` *(gitignored)*

VS Code workspace settings. Typically contains:
- `settings.json` — editor preferences (tab size, format on save, etc.)

Not committed so each developer keeps their own preferences.

---

## 🗃️ Database Tables (PostgreSQL)

### `leads`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK, auto-increment | — |
| `name` | VARCHAR | — | Lead's full name |
| `email` | VARCHAR | Unique (when not null) | Nullable |
| `company` | VARCHAR | — | — |
| `job_title` | VARCHAR | — | — |
| `location` | VARCHAR | — | City / region |
| `industry` | VARCHAR | — | Nullable |
| `linkedin_url` | VARCHAR | Unique index (non-null only) | Dedup guard |
| `status` | VARCHAR | Default `'New'` | New / Contacted / Qualified / Rejected |
| `notes` | TEXT | Nullable | Free-text notes |
| `created_at` | TIMESTAMP | Default `NOW()` | Auto-set on insert |

### `search_history`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | — |
| `user_query` | TEXT | Original NL query typed by user |
| `filters_generated` | TEXT | Google search string produced by Gemini or fallback |
| `total_results` | INTEGER | Number of leads scraped (not stored) |
| `created_at` | TIMESTAMP | Timestamp of search |

---

## 🛠️ Running the Project

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

# One-time DB migration (run after pulling schema changes)
python migrate.py
```
