# 🚀 LeadIntel AI — Deployment Guide

## Live URLs

| Service | URL |
|---|---|
| 🌐 **Frontend (Vercel)** | https://frontend-py0dda1db-sage1ll1001s-projects.vercel.app |
| ⚙️ **Backend (Render)** | https://leadintel-backend.onrender.com |
| 🗄️ **Database (Neon)** | `ep-nameless-band-ai90vupd-pooler.c-4.us-east-1.aws.neon.tech` |

---

## Architecture

```
User Browser
    │
    ▼
Vercel (React + Vite)          ← Frontend
    │  VITE_API_BASE env var
    ▼
Render (FastAPI + Uvicorn)     ← Backend (Free tier, sleeps after 15 min)
    │  DATABASE_URL env var
    ▼
Neon (PostgreSQL)              ← Database (Always on, free tier)
```

---

## Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React 18 + Vite | Vercel (Free) |
| Backend | FastAPI + Python 3 | Render (Free) |
| Database | PostgreSQL | Neon (Free) |
| AI | Google Gemini 2.0 Flash | API |
| Scraping | Apify Google Search Scraper | API |

---

## Environment Variables

### Render (Backend)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `GEMINI_API_KEY` | Google Gemini API key |
| `APIFY_API_TOKEN` | Apify scraper token |
| `FRONTEND_URL` | Vercel frontend URL (for CORS) |

### Vercel (Frontend)
| Variable | Description |
|---|---|
| `VITE_API_BASE` | Render backend URL |

> Set via `frontend/.env.production` file — auto-picked up at build time.

---

## Redeployment

Both services auto-redeploy on every `git push` to `main`:

```bash
git add .
git commit -m "your message"
git push
```

- **Render** watches the root (`main.py`) — backend redeploys automatically
- **Vercel** watches the `frontend/` folder — frontend redeploys automatically

---

## ⚠️ Important Notes

> **Render free tier sleeps** after 15 minutes of inactivity.  
> First request after sleep takes **30–60 seconds**. Subsequent requests are instant.

> **Database**: Neon free tier has a 0.5 GB storage limit and auto-pauses after 5 days of inactivity (resumes automatically on next request).

---

## Local Development

### Backend
```bash
cd leadgen_0
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
cp .env.example .env        # fill in your keys
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the frontend talks to `http://localhost:8000` by default.
