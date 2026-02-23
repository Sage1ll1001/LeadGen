# ⚡ LeadIntel AI — AI-Powered Lead Intelligence Platform

> Discover, enrich, track, and engage B2B leads using natural language — powered by Google Gemini, Apify, and PostgreSQL.

---

## 📸 Overview

LeadIntel AI lets you type a natural-language query like **"CEOs in Mumbai"** or **"SDEs at Microsoft from Bangalore"** and automatically:

1. Converts your query into an optimised Google search string (via Gemini AI)
2. Scrapes matching LinkedIn profiles (via Apify)
3. Stores enriched lead data in PostgreSQL (with LinkedIn URL dedup)
4. Lets you browse, filter by status, sort, paginate, and export leads as CSV
5. Generates personalised cold-outreach emails for each lead (via Gemini AI)
6. Tracks lead status (New → Contacted → Qualified → Rejected) and notes per row
7. Shows full search history with a one-click Re-run button

---

## 🗂️ Project Structure

```
leadgen_0/
├── main.py              # FastAPI backend — all API endpoints & business logic
├── migrate.py           # One-time DB migration script (adds missing columns)
├── .env                 # Secret keys (never committed)
├── .env.example         # Template for environment variables
├── .gitignore           # Excludes .env, venv, __pycache__, etc.
└── frontend/            # React + Vite frontend
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx         # App entry point
        ├── App.jsx          # Router + layout (Search, Dashboard, History)
        ├── index.css        # Design system & utility styles
        ├── api.js           # All fetch calls to the backend
        ├── components/
        │   ├── LeadsTable.jsx   # Sortable table + Status dropdown + Notes editor + Email modal
        │   ├── SearchBar.jsx    # Natural language search input
        │   ├── Loader.jsx       # Spinner component
        │   └── Toast.jsx        # Success/error notification
        └── pages/
            ├── SearchPage.jsx   # Search UI + recent searches pills
            ├── LeadsPage.jsx    # Dashboard: filter by status, sort, paginated, CSV export
            └── HistoryPage.jsx  # Search history table with Re-run button
```

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, Uvicorn |
| AI | Google Gemini 2.0 Flash (`google-genai`) |
| Scraping | Apify — Google Search Scraper actor |
| Database | PostgreSQL (via SQLAlchemy + psycopg2) |
| Frontend | React 19, Vite 7, React Router v7 |
| Styling | Vanilla CSS (dark mode, glassmorphism) |

---

## ⚙️ Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
GEMINI_API_KEY=your_google_gemini_api_key
APIFY_API_TOKEN=your_apify_api_token
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `APIFY_API_TOKEN` | [Apify Console → Settings → Integrations](https://console.apify.com/account/integrations) |
| `DATABASE_URL` | Your PostgreSQL provider (Supabase, Neon, Railway, etc.) |

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/Sage1ll1001/LeadGen.git
cd LeadGen
```

### 2. Set up the Python backend

```bash
python -m venv venv
venv\Scripts\activate        # Windows
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv requests google-genai
cp .env.example .env
```

### 3. Run the database migration

```bash
python migrate.py
```

### 4. Start the backend

```bash
uvicorn main:app --reload
# Runs at http://127.0.0.1:8000
# API docs at http://127.0.0.1:8000/docs
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
# Runs at http://localhost:5173
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/search-leads` | Convert NL query → scrape → store leads |
| `GET` | `/leads` | Paginated, filterable, sortable leads list |
| `PATCH` | `/leads/{id}` | Update lead status and/or notes |
| `GET` | `/search-history` | Paginated search history |
| `GET` | `/download-leads` | Export filtered leads as CSV |
| `POST` | `/generate-email` | Generate personalised outreach email |
| `GET` | `/health` | Health check |

### `GET /leads` Query Params

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `limit` | int | 10 | Results per page (max 100) |
| `search` | string | "" | Filter by name/company/title/location |
| `status` | string | "" | Filter by status (New/Contacted/Qualified/Rejected) |
| `sort_by` | string | "created_at" | Column to sort |
| `order` | string | "desc" | "asc" or "desc" |

### `PATCH /leads/{id}`

```json
{ "status": "Contacted", "notes": "Replied positively." }
```

### `GET /download-leads` — same query params as `/leads` (no pagination)

---

## 🤖 Gemini Features

| Feature | Behaviour |
|---|---|
| **Query parsing** | Converts NL → optimised Google search query |
| **Quota retry** | On 429, parses `retryDelay`, sleeps up to 60s, retries once |
| **Fallback (search)** | Keyword-based query builder (strips stopwords) |
| **Fallback (email)** | Returns a professional template using the lead's details |

---

## 🗄️ Database Schema

### `leads` table

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | Primary key, auto-increment |
| `name` | VARCHAR | Lead's full name |
| `email` | VARCHAR | Nullable, unique when present |
| `company` | VARCHAR | Company name |
| `job_title` | VARCHAR | Job title / role |
| `location` | VARCHAR | City / region |
| `industry` | VARCHAR | Industry sector |
| `linkedin_url` | VARCHAR | LinkedIn URL — unique index (non-null only) |
| `status` | VARCHAR | `New` / `Contacted` / `Qualified` / `Rejected` |
| `notes` | TEXT | Free-text notes, nullable |
| `created_at` | TIMESTAMP | Auto-set on insert |

### `search_history` table

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | Primary key |
| `user_query` | TEXT | Original NL query |
| `filters_generated` | TEXT | Google search string produced |
| `total_results` | INTEGER | Number of results scraped |
| `created_at` | TIMESTAMP | Timestamp of search |

---

## 🛠️ Development Notes

- **Hot reload:** Both `uvicorn --reload` and `vite` watch for file changes automatically
- **CORS:** Backend allows `http://localhost:5173` and `http://127.0.0.1:5173`
- **Dedup:** Leads with the same email **or** linkedin_url are skipped on insert
- **Status tracking:** Stored in DB; updates persist across refreshes
- **Notes:** Click any notes cell to enter edit mode; blur to auto-save

---

## 📦 Deployment

1. Set environment variables in your hosting platform (never commit `.env`)
2. Run `python migrate.py` once against your production database
3. Build the frontend: `cd frontend && npm run build` (outputs to `frontend/dist/`)
4. Serve the FastAPI app with gunicorn or uvicorn behind a reverse proxy (nginx)

---

## 📄 License

MIT — feel free to use, fork, and improve.


---

## 📸 Overview

LeadIntel AI lets you type a natural-language query like **"CEOs in Mumbai"** or **"SDEs at Microsoft from Bangalore"** and automatically:

1. Converts your query into an optimised Google search string (via Gemini AI)
2. Scrapes matching LinkedIn profiles (via Apify)
3. Stores enriched lead data in a PostgreSQL database
4. Lets you browse, search, sort, paginate, and export leads
5. Generates personalised cold-outreach emails for each lead (via Gemini AI)

---

## 🗂️ Project Structure

```
leadgen_0/
├── main.py              # FastAPI backend — all API endpoints & business logic
├── migrate.py           # One-time DB migration script (adds missing columns)
├── .env                 # Secret keys (never committed)
├── .env.example         # Template for environment variables
├── .gitignore           # Excludes .env, venv, __pycache__, etc.
├── requirements.txt     # Python dependencies (if present)
└── frontend/            # React + Vite frontend
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx         # App entry point
        ├── App.jsx          # Router + layout
        ├── App.css          # Global app styles
        ├── index.css        # Design system & utility styles
        ├── api.js           # All fetch calls to the backend
        ├── components/
        │   ├── LeadsTable.jsx   # Paginated, sortable leads table + email modal
        │   ├── SearchBar.jsx    # Natural language search input
        │   ├── Loader.jsx       # Spinner component
        │   └── Toast.jsx        # Success/error notification
        └── pages/
            ├── SearchPage.jsx   # Search UI page
            └── LeadsPage.jsx    # Dashboard / leads browser page
```

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, Uvicorn |
| AI | Google Gemini 2.0 Flash (`google-genai`) |
| Scraping | Apify — Google Search Scraper actor |
| Database | PostgreSQL (via SQLAlchemy + psycopg2) |
| Frontend | React 19, Vite 7, React Router v7, Axios |
| Styling | Vanilla CSS (dark mode, glassmorphism) |

---

## ⚙️ Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
GEMINI_API_KEY=your_google_gemini_api_key
APIFY_API_TOKEN=your_apify_api_token
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `APIFY_API_TOKEN` | [Apify Console → Settings → Integrations](https://console.apify.com/account/integrations) |
| `DATABASE_URL` | Your PostgreSQL provider (Supabase, Neon, Railway, etc.) |

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/Sage1ll1001/LeadGen.git
cd LeadGen
```

### 2. Set up the Python backend

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv requests google-genai

# Copy and fill in your .env
cp .env.example .env
```

### 3. Run the database migration

Run this **once** after setting up your database to ensure all columns exist:

```bash
python migrate.py
```

### 4. Start the backend

```bash
uvicorn main:app --reload
# Runs at http://127.0.0.1:8000
# API docs at http://127.0.0.1:8000/docs
```

### 5. Set up and start the frontend

```bash
cd frontend
npm install
npm run dev
# Runs at http://localhost:5173
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/search-leads` | Convert NL query → scrape → store leads |
| `GET` | `/leads` | Paginated, sortable, searchable leads list |
| `GET` | `/download-leads` | Export all leads as CSV |
| `POST` | `/generate-email` | Generate personalised outreach email |
| `GET` | `/health` | Health check |

### `POST /search-leads`

```json
{ "query": "CEOs in Mumbai" }
```

Response:
```json
{
  "google_query": "site:linkedin.com/in \"CEO\" \"Mumbai\"",
  "leads_scraped": 10,
  "leads_stored": 8
}
```

### `GET /leads`

Query params: `page`, `limit`, `search`, `sort_by`, `order`

### `POST /generate-email`

```json
{
  "name": "Sundar Pichai",
  "company": "Google",
  "job_title": "CEO",
  "location": "Mountain View",
  "industry": "Technology"
}
```

---

## 🤖 Gemini Fallback Behaviour

The app gracefully handles Gemini free-tier quota limits:

| Endpoint | When Gemini is unavailable |
|---|---|
| `/search-leads` | Uses keyword-based query builder (strips stopwords, wraps in quotes) |
| `/generate-email` | Returns a professional template email using lead's actual details |

Your Gemini free-tier quota resets **daily (~12:30 PM IST)**. Once reset, AI-powered responses resume automatically.

---

## 🗄️ Database Schema

### `leads` table

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | Primary key, auto-increment |
| `name` | VARCHAR | Lead's full name |
| `email` | VARCHAR | Nullable, unique when present |
| `company` | VARCHAR | Company name |
| `job_title` | VARCHAR | Job title / role |
| `location` | VARCHAR | City / region |
| `industry` | VARCHAR | Industry sector |
| `linkedin_url` | VARCHAR | LinkedIn profile URL |
| `created_at` | TIMESTAMP | Auto-set on insert |

### `search_history` table

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | Primary key |
| `user_query` | TEXT | Original NL query |
| `filters_generated` | TEXT | Google search string produced |
| `total_results` | INTEGER | Number of results scraped |
| `created_at` | TIMESTAMP | Timestamp of search |

---

## 🛠️ Development Notes

- **Hot reload:** Both `uvicorn --reload` and `vite` watch for file changes automatically
- **CORS:** Backend allows `http://localhost:5173` and `http://127.0.0.1:5173`
- **Duplicate prevention:** Leads with the same email are skipped on insert
- **Null emails:** Multiple leads with no email are all stored (no duplicate conflict)

---

## 📦 Deployment

1. Set environment variables in your hosting platform (never commit `.env`)
2. Run `python migrate.py` once against your production database
3. Build the frontend: `cd frontend && npm run build` (outputs to `frontend/dist/`)
4. Serve the FastAPI app with gunicorn or uvicorn behind a reverse proxy (nginx)

---

## 📄 License

MIT — feel free to use, fork, and improve.