# 🔄 LeadIntel AI — Full Technical Workflow

This document describes the complete data flow, file responsibilities, and code architecture of the LeadIntel AI platform.

---

## 🗺️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER (Browser)                       │
│              http://localhost:5173                      │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (React + Vite)
┌──────────────────────▼──────────────────────────────────┐
│                  FRONTEND (React)                       │
│  SearchPage → SearchBar → api.js → POST /search-leads   │
│  LeadsPage  → LeadsTable → api.js → GET /leads          │
│                       → POST /generate-email            │
│                       → GET /download-leads             │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST (FastAPI)
┌──────────────────────▼──────────────────────────────────┐
│                BACKEND (FastAPI / main.py)               │
│                                                         │
│  /search-leads ──► Gemini AI ──► Apify ──► PostgreSQL   │
│  /generate-email ──► Gemini AI (or template fallback)   │
│  /leads ──────────────────────────► PostgreSQL (read)   │
│  /download-leads ──────────────────► PostgreSQL (read)  │
└──────────────────────┬──────────────────────────────────┘
         ┌─────────────┴──────────────────┐
         │                                │
┌────────▼────────┐             ┌─────────▼────────┐
│  Google Gemini  │             │   PostgreSQL DB   │
│  2.0 Flash API  │             │  (Supabase/Neon)  │
└─────────────────┘             └──────────────────┘
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

| Field | Type |
|---|---|
| id | Integer PK |
| name | String |
| email | String (nullable, unique) |
| company | String |
| job_title | String |
| location | String |
| industry | String |
| linkedin_url | String |
| created_at | DateTime |

**`SearchHistory` model → `search_history` table**

| Field | Type |
|---|---|
| id | Integer PK |
| user_query | Text |
| filters_generated | Text |
| total_results | Integer |
| created_at | DateTime |

`Base.metadata.create_all(bind=engine)` runs on startup — creates tables if they don't exist (does NOT alter existing tables; use `migrate.py` for schema changes).

---

#### Section 4 — Helper Functions

##### `gemini_generate(prompt: str) → str`
Calls Gemini 2.0 Flash with a text prompt. Raises `HTTPException(500)` on any failure (quota, auth, network).

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

**Gemini prompt template:**
```
Convert this lead search query into a Google search query to find LinkedIn profiles.
Return ONLY the raw search query string.

Examples:
Input: CEO in Mumbai
Output: site:linkedin.com/in "CEO" "Mumbai"

Input: SDE at Google from Bangalore
Output: site:linkedin.com/in "Software Engineer" "Google" "Bangalore"

Query: {query}
```

---

##### `fetch_leads_from_apify(search_query: str) → list`
Calls the Apify `apify~google-search-scraper` actor in sync mode.

**Request:**
```python
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
Inserts leads into PostgreSQL. Skips duplicates by checking if an `email` already exists.

- Leads with no email (`null`) are always inserted (PostgreSQL treats each NULL as unique)
- Returns count of newly inserted leads
- Rolls back transaction on any DB error

---

##### `log_search(query, filters, total)`
Inserts a record into `search_history` table. Non-critical; failures are logged but don't break the flow.

---

#### Section 5 — API Endpoints

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
store_leads()  ←── PostgreSQL INSERT
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
| `sort_by` | `created_at` | Column to sort by |
| `order` | `desc` | `asc` or `desc` |

**Valid sort columns:** `id, name, company, job_title, location, created_at`

Response shape:
```json
{
  "total": 58,
  "page": 1,
  "limit": 10,
  "pages": 6,
  "leads": [ { "id", "name", "email", "company", "job_title", "location", "industry", "linkedin_url", "created_at" } ]
}
```

---

##### `GET /download-leads`

Streams the full leads table as a CSV file. Headers:
```
ID, Name, Email, Company, Job Title, Location, Industry, LinkedIn URL, Created At
```

Uses `StreamingResponse` with `text/csv` MIME type and `Content-Disposition: attachment`.

---

##### `POST /generate-email`

Request body:
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

### `migrate.py` — Database Migration

Run **once** to add columns that were added to the SQLAlchemy model after the table was first created.

```python
migrations = [
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS job_title VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS location VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS email VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS company VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();",
]
```

Uses `ADD COLUMN IF NOT EXISTS` — safe to re-run multiple times.

---

### `frontend/src/api.js` — API Layer

Centralised fetch wrapper for all backend calls. All functions:
- Accept typed parameters
- Return parsed JSON on success
- Throw `Error` with the raw response text on failure (for display in Toast)

| Function | Method | Endpoint |
|---|---|---|
| `searchLeads(query)` | POST | `/search-leads` |
| `getLeads({ page, limit, search, sort_by, order })` | GET | `/leads` |
| `generateEmail(lead)` | POST | `/generate-email` |
| `downloadLeadsUrl()` | — | Returns `/download-leads` URL |

---

### `frontend/src/App.jsx` — Router

Sets up React Router with two routes:

| Path | Component |
|---|---|
| `/` | `SearchPage` |
| `/leads` | `LeadsPage` |

Contains the top navigation bar (`⚡ LeadIntel AI`, Search, Dashboard links).

---

### `frontend/src/pages/SearchPage.jsx`

The main search interface.

**State:**
- `loading` — shows `<Loader />` while request is in-flight
- `result` — displays `google_query`, `leads_scraped`, `leads_stored` after success
- `error` — shows `<Toast />` on failure

**Flow:**
1. User types query in `<SearchBar />`
2. Calls `searchLeads(query)` from `api.js`
3. On success: shows result card with stats
4. On error: shows Toast with error message

---

### `frontend/src/pages/LeadsPage.jsx`

The leads dashboard/browser.

**State:**
- `leads` — array of lead objects
- `pagination` — `{ total, page, pages, limit }`
- `search` — live filter string
- `sortBy`, `order` — current sort config
- `loading`, `error`

**Flow:**
1. On mount and on any filter/page/sort change → calls `getLeads(params)`
2. Passes `leads` and handlers to `<LeadsTable />`
3. Shows pagination controls

---

### `frontend/src/components/SearchBar.jsx`

Controlled input with:
- Submit on Enter key or button click
- Disabled state while loading
- Passes query string up to `onSearch` callback

---

### `frontend/src/components/LeadsTable.jsx`

The most complex component. Renders:

1. **Summary bar** — Total Leads, This Page, Total Pages, Current Page
2. **Leads table** — one row per lead with columns: Name/Title, Company, Email, Location, Date, Industry, LinkedIn
3. **Email modal** — Clicking the email button calls `generateEmail(lead)`, then shows an overlay with the subject + body, and a Copy button
4. **CSV download** — Links to `/download-leads` directly
5. **Pagination** — Prev/Next buttons

**Sort:** Clicking column headers toggles `asc`/`desc` and passes new sort config up.

---

### `frontend/src/components/Loader.jsx`

Simple animated spinner displayed during async operations.

---

### `frontend/src/components/Toast.jsx`

Notification banner that auto-hides after a timeout. Shows success (green) or error (red) messages.

---

### `frontend/src/index.css`

Full design system: CSS custom properties, dark-mode theme, glassmorphism card styles, button variants, table styles, modal overlay, animations, and responsive breakpoints.

---

## 🔄 End-to-End Data Flow

### Scenario: User searches "CEOs in Mumbai"

```
1. User types "CEOs in Mumbai" → clicks Search
2. SearchPage.jsx → searchLeads("CEOs in Mumbai") [api.js]
3. api.js → POST http://127.0.0.1:8000/search-leads { query: "CEOs in Mumbai" }
4. main.py:search_leads() → build_google_query("CEOs in Mumbai")
5.   → gemini_generate(prompt)  [Gemini API call]
6.   ← "site:linkedin.com/in \"CEO\" \"Mumbai\""     [or fallback]
7. main.py → fetch_leads_from_apify("site:linkedin.com/in \"CEO\" \"Mumbai\"")
8.   → POST https://api.apify.com/v2/acts/apify~google-search-scraper/...
9.   ← [ { name, linkedin_url, company, job_title, ... }, ... ]  (10 results)
10. main.py → store_leads(leads)  → INSERT INTO leads ...  (8 new, 2 duplicates skipped)
11. main.py → log_search(...)     → INSERT INTO search_history ...
12. ← { google_query, leads_scraped: 10, leads_stored: 8 }
13. SearchPage.jsx renders result card with stats
```

### Scenario: User opens Leads Dashboard

```
1. User navigates to /leads
2. LeadsPage.jsx mounts → getLeads({ page:1, limit:10, sort_by:"created_at", order:"desc" })
3. api.js → GET /leads?page=1&limit=10&search=&sort_by=created_at&order=desc
4. main.py:get_leads() → db.query(Lead).order_by(Lead.created_at.desc()).count() + .all()
5. ← { total: 58, page: 1, pages: 6, leads: [...] }
6. LeadsTable.jsx renders table rows
```

### Scenario: User clicks ✉️ Email for a lead

```
1. User clicks email button on "K Krithivasan" row
2. LeadsTable.jsx → generateEmail({ name, company, job_title, location, industry })
3. api.js → POST /generate-email { name: "K Krithivasan", company: "TCS", job_title: "CEO & MD", ... }
4. main.py:generate_email()
   → try: gemini_generate(B2B_prompt)
   → catch HTTPException (quota): return template_email()
5. ← { subject: "Quick note for K Krithivasan at TCS", body: "Hi K Krithivasan, ..." }
6. LeadsTable.jsx opens modal with subject + body
7. User clicks Copy → clipboard.writeText(body)
```

---

## 🧩 Key Design Decisions

| Decision | Rationale |
|---|---|
| Single `main.py` backend file | Simple MVP — easy to read, deploy, and modify |
| `ADD COLUMN IF NOT EXISTS` in migrate.py | Idempotent migrations — safe to re-run without errors |
| Gemini fallback on all AI endpoints | App stays functional even when free-tier quota is exhausted |
| `UniqueConstraint` on email (nullable) | Prevents duplicate leads when email is known; allows multiple no-email leads |
| `v1beta` Gemini API version | Required for `gemini-2.0-flash` model access |
| Centralised `api.js` | Single source of truth for all backend URLs; easy to swap base URL for production |
| React Router v7 with two pages | Clean separation between search UI and lead dashboard |

---

## 🐛 Known Issues & Fixes Applied

| Issue | Root Cause | Fix Applied |
|---|---|---|
| `column leads.job_title does not exist` | `create_all()` doesn't ALTER existing tables | `migrate.py` with `ADD COLUMN IF NOT EXISTS` |
| `500 Gemini failed: 429` on search | Free-tier daily quota exhausted | `build_google_query_fallback()` |
| `500 Gemini failed: 429` on email | Free-tier daily quota exhausted | `template_email()` fallback in `generate_email()` |
| `404 models/gemini-1.5-flash-latest not found` | Deprecated model name | Updated to `gemini-2.0-flash` with `v1beta` |
| Generic "Database error" with no details | Exception swallowed in `store_leads` | Changed to `f"Database error: {str(e)}"` |
