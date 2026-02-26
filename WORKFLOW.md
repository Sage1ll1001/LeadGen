# 🔄 LeadIntel AI — Full Technical Workflow

This document describes the complete data flow, file responsibilities, and code architecture of the LeadIntel AI platform.

---

## 🗺️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER (Browser)                       │
│   https://frontend-py0dda1db-sage1ll1001s-projects      │
│                    .vercel.app                          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS (React + Vite on Vercel)
┌──────────────────────▼──────────────────────────────────┐
│                  FRONTEND (React)                       │
│  SearchPage  → SearchBar → api.js → POST /search-leads  │
│  LeadsPage   → LeadsTable → api.js → GET /leads         │
│                       → PATCH /leads/{id}               │
│                       → POST /generate-email            │
│                       → GET /download-leads             │
│  HistoryPage → api.js → GET /search-history             │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS/REST (FastAPI on Render)
┌──────────────────────▼──────────────────────────────────┐
│          BACKEND (FastAPI / main.py on Render)          │
│                                                         │
│  /search-leads ──► Gemini AI ──► Apify ──► PostgreSQL   │
│  /generate-email ──► Gemini AI (or template fallback)   │
│  /leads ──────────────────────────► PostgreSQL (read)   │
│  /leads/{id} (PATCH) ─────────────► PostgreSQL (write)  │
│  /search-history ─────────────────► PostgreSQL (read)   │
│  /download-leads ──────────────────► PostgreSQL (read)  │
└──────────────────────┬──────────────────────────────────┘
         ┌─────────────┴──────────────────┐
         │                                │
┌────────▼────────┐             ┌─────────▼───────────┐
│  Google Gemini  │             │   PostgreSQL (Neon)  │
│  2.0 Flash API  │             │   Free Tier          │
└─────────────────┘             └─────────────────────┘
         +
┌─────────────────┐
│  Apify Scraper  │
│ (Google Search) │
└─────────────────┘
```

---

## 📁 File-by-File Breakdown

---

### `main.py` — Backend (FastAPI)

The single-file backend. Handles environment loading, DB models, helper functions, and all API routes.

#### Section 1 — Imports & Environment

```python
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
APIFY_TOKEN    = os.getenv("APIFY_API_TOKEN")
DATABASE_URL   = os.getenv("DATABASE_URL")
```

Loads all secrets from `.env` at startup. Raises immediately if any are missing.

---

#### Section 2 — Gemini Client Setup

```python
client = genai.Client(api_key=GEMINI_API_KEY, http_options={"api_version": "v1beta"})
GEMINI_MODEL = "gemini-2.0-flash"
```

Uses `v1beta` API version (required for `gemini-2.0-flash`).

---

#### Section 3 — Database Models (SQLAlchemy ORM)

**`Lead` model → `leads` table**

| Field | Type | Notes |
|---|---|---|
| id | Integer PK | Auto-increment |
| name | String | |
| email | String | Nullable, unique when present |
| company | String | |
| job_title | String | |
| location | String | |
| industry | String | |
| linkedin_url | String | Unique index (non-null rows only) |
| status | String | Default `'New'` |
| notes | Text | Nullable |
| created_at | DateTime | Auto-set |

**`SearchHistory` model → `search_history` table**

| Field | Type |
|---|---|
| id | Integer PK |
| user_query | Text |
| filters_generated | Text |
| total_results | Integer |
| created_at | DateTime |

`Base.metadata.create_all(bind=engine)` runs on startup — creates tables if they don't exist. Does NOT alter existing tables; use `migrate.py` for schema changes.

---

#### Section 4 — CORS Middleware

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        FRONTEND_URL,           # specific Vercel URL from env
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",  # wildcard Vercel subdomains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> `allow_origins` does NOT support wildcards like `https://*.vercel.app` — that's why `allow_origin_regex` is used instead.

---

#### Section 5 — Helper Functions

##### `gemini_generate(prompt: str) → str`
Calls Gemini 2.0 Flash. On 429 quota error, parses `retryDelay` from the error, sleeps up to 60s, and retries once. Raises `HTTPException(500)` on second failure.

---

##### `build_google_query_fallback(query: str) → str`
Rule-based fallback when Gemini is unavailable.

**Algorithm:**
1. Split query into words
2. Remove stopwords: `in, at, from, the, a, an, of, and, for, with, by`
3. Wrap remaining words in double-quotes
4. Prepend `site:linkedin.com/in`

**Example:**
```
Input:  "SDEs in Microsoft from Mumbai"
Output: site:linkedin.com/in "SDEs" "Microsoft" "Mumbai"
```

---

##### `build_google_query(query: str) → str`
Tries Gemini first; catches `HTTPException` and falls back to `build_google_query_fallback`.

---

##### `fetch_leads_from_apify(search_query: str) → list`
Calls the Apify `apify~google-search-scraper` actor in sync mode.

**Request:**
```
POST https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=...
Body: { "queries": search_query, "maxPagesPerQuery": 1 }
```

**Parsing logic:**
- Takes `organicResults` from the first result
- Filters to only URLs containing `linkedin.com/in`
- Parses `title` field: splits on `" - "` to extract name and job title
- Falls back to `personalInfo.jobTitle` if present

**Returns:** List of dicts with `name, email, company, job_title, location, industry, linkedin_url`

---

##### `store_leads(leads: list) → int`
Inserts leads into PostgreSQL. Skips duplicates by checking:
1. If `email` already exists (and email is not null)
2. If `linkedin_url` already exists

- Returns count of newly inserted leads
- Rolls back transaction on any DB error

---

##### `log_search(query, filters, total)`
Inserts a record into `search_history`. Non-critical — failures are logged but don't break the flow.

---

#### Section 6 — API Endpoints

##### `POST /search-leads`

**Full flow:**
```
User query (string)
    │
    ▼
build_google_query()  ←── Gemini (or fallback)
    │
    ▼
fetch_leads_from_apify()  ←── Apify Google Search Scraper
    │
    ▼
store_leads()  ←── PostgreSQL INSERT (skips duplicates)
    │
    ▼
log_search()   ←── PostgreSQL INSERT (search_history)
    │
    ▼
Response: { google_query, leads_scraped, leads_stored }
```

---

##### `GET /leads`

Query params:

| Param | Default | Description |
|---|---|---|
| `page` | 1 | Page number (≥1) |
| `limit` | 10 | Items per page (1–100) |
| `search` | `""` | Filter by name/company/job_title/location (ILIKE) |
| `status` | `""` | Filter by status (New/Contacted/Qualified/Rejected) |
| `sort_by` | `created_at` | Column to sort by |
| `order` | `desc` | `asc` or `desc` |

Response:
```json
{
  "total": 58, "page": 1, "limit": 10, "pages": 6,
  "leads": [{ "id", "name", "email", "company", "job_title", "location",
               "industry", "linkedin_url", "status", "notes", "created_at" }]
}
```

---

##### `PATCH /leads/{id}`

Updates status and/or notes for a lead.

```json
{ "status": "Contacted", "notes": "Replied positively." }
```

Validates status against `{ "New", "Contacted", "Qualified", "Rejected" }`.

---

##### `GET /search-history`

Returns paginated search history entries ordered by `created_at`.

---

##### `GET /download-leads`

Accepts same filter params as `GET /leads` (no pagination). Streams full filtered results as CSV.

CSV headers:
```
ID, Name, Email, Company, Job Title, Location, Industry, LinkedIn URL, Status, Notes, Created At
```

---

##### `POST /generate-email`

```json
{ "name": "...", "company": "...", "job_title": "...", "location": "...", "industry": "..." }
```

**Flow:**
1. Try Gemini with a B2B sales prompt
2. On `HTTPException` → use `template_email()` fallback
3. Strip markdown code fences from Gemini response
4. Parse JSON: `{ "subject": "...", "body": "..." }`
5. On JSON parse failure → fallback to template

---

### `frontend/src/api.js` — API Layer

All backend calls centralised here. Base URL read from `import.meta.env.VITE_API_BASE` (falls back to `http://localhost:8000`).

---

### `frontend/src/App.jsx` — Router

Three routes:

| Path | Component |
|---|---|
| `/` | `SearchPage` |
| `/leads` | `LeadsPage` |
| `/history` | `HistoryPage` |

---

### `frontend/vercel.json` — SPA Routing

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Required so direct URL access to `/leads` or `/history` doesn't return a 404 from Vercel's CDN.

---

## 🔄 End-to-End Scenarios

### Scenario: User searches "CEOs in Mumbai"

```
1. User types "CEOs in Mumbai" → clicks Search
2. SearchPage.jsx → searchLeads("CEOs in Mumbai") [api.js]
3. api.js → POST https://leadintel-backend.onrender.com/search-leads
4. main.py:search_leads() → build_google_query("CEOs in Mumbai")
5.   → gemini_generate(prompt)        [Gemini API]
6.   ← "site:linkedin.com/in \"CEO\" \"Mumbai\""
7. main.py → fetch_leads_from_apify(...)
8.   → POST https://api.apify.com/v2/.../apify~google-search-scraper/...
9.   ← [ { name, linkedin_url, company, job_title, ... } ]  (10 results)
10. store_leads() → INSERT INTO leads ... (8 new, 2 skipped as duplicates)
11. log_search()  → INSERT INTO search_history ...
12. ← { google_query, leads_scraped: 10, leads_stored: 8 }
13. SearchPage.jsx renders result banner with stats
14. Query saved to localStorage recent searches
```

### Scenario: User opens Dashboard

```
1. User navigates to /leads (via nav link or direct URL)
2. Vercel serves index.html (via vercel.json rewrite)
3. React Router renders LeadsPage
4. LeadsPage mounts → getLeads({ page:1, limit:10, sort_by:"created_at", order:"desc" })
5. api.js → GET /leads?page=1&limit=10&...
6. main.py → db.query(Lead).order_by().count() + .all()
7. ← { total, page, pages, leads: [...] }
8. LeadsTable renders rows with status badges, notes, email buttons
```

### Scenario: User clicks ✉️ Email

```
1. User clicks email button on lead row
2. EmailModal opens, calls generateEmail({ name, company, ... })
3. api.js → POST /generate-email
4. main.py → gemini_generate(B2B prompt) → or template_email() fallback
5. ← { subject: "...", body: "..." }
6. Modal displays subject + body with Copy button
```

### Scenario: User re-runs a past search

```
1. User navigates to /history
2. HistoryPage fetches GET /search-history
3. User clicks "↺ Re-run" on a row
4. Calls searchLeads(row.user_query)
5. On success → navigate("/leads")
```

---

## 🧩 Key Design Decisions

| Decision | Rationale |
|---|---|
| Single `main.py` backend | Simple MVP — easy to read, deploy, and modify |
| `ADD COLUMN IF NOT EXISTS` in migrate.py | Idempotent migrations — safe to re-run without errors |
| Gemini fallback on all AI endpoints | App stays functional even when free-tier quota is exhausted |
| `allow_origin_regex` for Vercel CORS | `CORSMiddleware` doesn't support wildcard subdomains in `allow_origins` |
| `vercel.json` SPA rewrites | React Router needs all routes served from `index.html` |
| Dedup by email **AND** linkedin_url | Email can be null, so linkedin_url provides a second dedup guard |
| `v1beta` Gemini API version | Required for `gemini-2.0-flash` model access |
| Centralised `api.js` | Single source of truth for backend URL; easy to swap for production |

---

## 🐛 Known Issues & Fixes Applied

| Issue | Root Cause | Fix |
|---|---|---|
| `column leads.job_title does not exist` | `create_all()` doesn't ALTER existing tables | `migrate.py` with `ADD COLUMN IF NOT EXISTS` |
| `500 Gemini failed: 429` | Free-tier daily quota exhausted | `build_google_query_fallback()` + `template_email()` |
| `404 models/gemini-1.5-flash-latest not found` | Deprecated model name | Updated to `gemini-2.0-flash` with `v1beta` |
| CORS blocked on Vercel subdomain | `allow_origins` doesn't support `*.vercel.app` wildcard | `allow_origin_regex=r"https://.*\.vercel\.app"` |
| Direct URL `/leads` returns Vercel 404 | Vercel CDN doesn't know about React Router routes | `frontend/vercel.json` with `rewrites` |
