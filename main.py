import os
import re
import json
import csv
import io
import time
import requests
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional

from sqlalchemy import (
    create_engine, Column, String, Integer, Text,
    DateTime, UniqueConstraint, text
)
from sqlalchemy.orm import declarative_base, sessionmaker

# =========================
# Load ENV
# =========================
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
APIFY_TOKEN    = os.getenv("APIFY_API_TOKEN")
DATABASE_URL   = os.getenv("DATABASE_URL")

if not GEMINI_API_KEY:
    raise Exception("GEMINI_API_KEY not found in .env")
if not APIFY_TOKEN:
    raise Exception("APIFY_API_TOKEN not found in .env")
if not DATABASE_URL:
    raise Exception("DATABASE_URL not found in .env")

# =========================
# Gemini Setup
# =========================
from google import genai

client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options={"api_version": "v1beta"}
)
GEMINI_MODEL = "gemini-2.0-flash"

# =========================
# Database Setup
# =========================
engine       = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base         = declarative_base()

LEAD_STATUSES = {"New", "Contacted", "Qualified", "Rejected"}


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        UniqueConstraint("email", name="uq_leads_email"),
    )

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String)
    email        = Column(String, nullable=True)
    company      = Column(String)
    job_title    = Column(String)
    location     = Column(String)
    industry     = Column(String)
    linkedin_url = Column(String)
    status       = Column(String, default="New")
    notes        = Column(Text, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)


class SearchHistory(Base):
    __tablename__ = "search_history"

    id                = Column(Integer, primary_key=True, index=True)
    user_query        = Column(Text)
    filters_generated = Column(Text)
    total_results     = Column(Integer, default=0)
    created_at        = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)

# =========================
# FastAPI App + CORS
# =========================
app = FastAPI(title="AI Lead Intelligence Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Pydantic Models
# =========================
class SearchRequest(BaseModel):
    query: str

class EmailRequest(BaseModel):
    name:      str
    company:   Optional[str] = None
    job_title: Optional[str] = None
    location:  Optional[str] = None
    industry:  Optional[str] = None

class LeadUpdateRequest(BaseModel):
    status: Optional[str] = None
    notes:  Optional[str] = None

# =========================
# Helpers
# =========================

def _parse_retry_delay(error_str: str) -> float:
    """Extract retryDelay seconds from a Gemini 429 error string."""
    match = re.search(r"retryDelay.*?(\d+)s", error_str)
    if match:
        return min(float(match.group(1)), 60.0)
    return 10.0


def gemini_generate(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response. Retries once on 429."""
    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            return response.text.strip()
        except Exception as e:
            err_str = str(e)
            is_quota = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str
            if is_quota and attempt == 0:
                delay = _parse_retry_delay(err_str)
                print(f"Gemini quota hit. Retrying after {delay:.0f}s…")
                time.sleep(delay)
                continue
            print("Gemini error:", e)
            raise HTTPException(status_code=500, detail=f"Gemini failed: {err_str}")


def build_google_query_fallback(query: str) -> str:
    """Simple rule-based fallback: wraps each keyword in quotes."""
    stopwords = {"in", "at", "from", "the", "a", "an", "of", "and", "for", "with", "by"}
    words    = query.split()
    keywords = [w for w in words if w.lower() not in stopwords]
    quoted   = " ".join(f'"{k}"' for k in keywords)
    return f'site:linkedin.com/in {quoted}'


def build_google_query(query: str) -> str:
    prompt = f"""
Convert this lead search query into a Google search query to find LinkedIn profiles.
Return ONLY the raw search query string. No explanation, no quotes around the full answer.

Examples:
Input: CEO in Mumbai
Output: site:linkedin.com/in "CEO" "Mumbai"

Input: SDE at Google from Bangalore
Output: site:linkedin.com/in "Software Engineer" "Google" "Bangalore"

Query: {query}
"""
    try:
        return gemini_generate(prompt)
    except HTTPException:
        print("Gemini unavailable, using fallback query builder.")
        return build_google_query_fallback(query)


def fetch_leads_from_apify(search_query: str) -> list:
    url = (
        "https://api.apify.com/v2/acts/apify~google-search-scraper"
        f"/run-sync-get-dataset-items?token={APIFY_TOKEN}"
    )
    payload = {"queries": search_query, "maxPagesPerQuery": 1}

    try:
        resp = requests.post(url, json=payload, timeout=60)
        print("Apify status:", resp.status_code)

        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail="Apify API failed")

        results = resp.json()
        if not results:
            return []

        organic = results[0].get("organicResults", [])
        leads   = []

        for item in organic:
            link = item.get("url", "")
            if "linkedin.com/in" not in link:
                continue

            info  = item.get("personalInfo", {})
            title = item.get("title", "")

            parts = title.split(" - ")
            name  = parts[0].strip() if parts else title
            job   = info.get("jobTitle") or (parts[1].strip() if len(parts) > 1 else None)

            leads.append({
                "name":         name,
                "email":        None,
                "company":      info.get("companyName"),
                "job_title":    job,
                "location":     info.get("location"),
                "industry":     None,
                "linkedin_url": link,
            })

        return leads

    except HTTPException:
        raise
    except Exception as e:
        print("Apify error:", e)
        raise HTTPException(status_code=502, detail="Apify request failed")


def store_leads(leads: list) -> int:
    """Insert leads, skipping duplicates by email OR linkedin_url."""
    db     = SessionLocal()
    stored = 0
    try:
        for lead in leads:
            email        = lead.get("email")
            linkedin_url = lead.get("linkedin_url")

            # Skip if email already exists
            if email and db.query(Lead).filter(Lead.email == email).first():
                continue

            # Skip if linkedin_url already exists
            if linkedin_url and db.query(Lead).filter(Lead.linkedin_url == linkedin_url).first():
                continue

            new_lead = Lead(
                name         = lead.get("name"),
                email        = email,
                company      = lead.get("company"),
                job_title    = lead.get("job_title"),
                location     = lead.get("location"),
                industry     = lead.get("industry"),
                linkedin_url = linkedin_url,
                status       = "New",
            )
            db.add(new_lead)
            stored += 1

        db.commit()
        return stored

    except Exception as e:
        db.rollback()
        print("DB error:", e)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()


def log_search(query: str, filters: str, total: int):
    db = SessionLocal()
    try:
        record = SearchHistory(
            user_query        = query,
            filters_generated = filters,
            total_results     = total,
        )
        db.add(record)
        db.commit()
    except Exception as e:
        db.rollback()
        print("Search log error:", e)
    finally:
        db.close()


# =========================
# Endpoints
# =========================

@app.post("/search-leads")
def search_leads(data: SearchRequest):
    """Convert natural language query → Google search → Apify scrape → DB store."""
    print("Incoming query:", data.query)

    google_query = build_google_query(data.query)
    print("Google query:", google_query)

    leads        = fetch_leads_from_apify(google_query)
    stored_count = store_leads(leads)

    log_search(data.query, google_query, len(leads))

    return {
        "google_query":  google_query,
        "leads_scraped": len(leads),
        "leads_stored":  stored_count,
    }


@app.get("/leads")
def get_leads(
    page:    int = Query(1, ge=1),
    limit:   int = Query(10, ge=1, le=100),
    search:  str = Query("", description="Filter by name/company/title/location"),
    status:  str = Query("", description="Filter by status (New/Contacted/Qualified/Rejected)"),
    sort_by: str = Query("created_at"),
    order:   str = Query("desc"),
):
    """Return paginated, filterable, sortable list of leads."""
    db = SessionLocal()
    try:
        q = db.query(Lead)

        if search:
            like = f"%{search}%"
            q = q.filter(
                Lead.name.ilike(like) |
                Lead.company.ilike(like) |
                Lead.job_title.ilike(like) |
                Lead.location.ilike(like)
            )

        if status and status in LEAD_STATUSES:
            q = q.filter(Lead.status == status)

        valid_cols = {"id", "name", "company", "job_title", "location", "created_at", "status"}
        if sort_by not in valid_cols:
            sort_by = "created_at"

        col = getattr(Lead, sort_by)
        q   = q.order_by(col.desc() if order == "desc" else col.asc())

        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()

        return {
            "total": total,
            "page":  page,
            "limit": limit,
            "pages": (total + limit - 1) // limit if total > 0 else 0,
            "leads": [
                {
                    "id":           l.id,
                    "name":         l.name,
                    "email":        l.email,
                    "company":      l.company,
                    "job_title":    l.job_title,
                    "location":     l.location,
                    "industry":     l.industry,
                    "linkedin_url": l.linkedin_url,
                    "status":       l.status or "New",
                    "notes":        l.notes,
                    "created_at":   l.created_at.isoformat() if l.created_at else None,
                }
                for l in items
            ],
        }
    finally:
        db.close()


@app.patch("/leads/{lead_id}")
def update_lead(lead_id: int, data: LeadUpdateRequest):
    """Update lead status and/or notes."""
    db = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        if data.status is not None:
            if data.status not in LEAD_STATUSES:
                raise HTTPException(status_code=400, detail=f"Invalid status. Use one of: {LEAD_STATUSES}")
            lead.status = data.status

        if data.notes is not None:
            lead.notes = data.notes

        db.commit()
        db.refresh(lead)

        return {
            "id":     lead.id,
            "status": lead.status,
            "notes":  lead.notes,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Update error: {str(e)}")
    finally:
        db.close()


@app.get("/search-history")
def get_search_history(
    page:  int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    order: str = Query("desc"),
):
    """Return paginated search history."""
    db = SessionLocal()
    try:
        q = db.query(SearchHistory)
        q = q.order_by(
            SearchHistory.created_at.desc() if order == "desc"
            else SearchHistory.created_at.asc()
        )
        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()

        return {
            "total": total,
            "page":  page,
            "pages": (total + limit - 1) // limit if total > 0 else 0,
            "history": [
                {
                    "id":                h.id,
                    "user_query":        h.user_query,
                    "filters_generated": h.filters_generated,
                    "total_results":     h.total_results,
                    "created_at":        h.created_at.isoformat() if h.created_at else None,
                }
                for h in items
            ],
        }
    finally:
        db.close()


@app.get("/download-leads")
def download_leads(
    search:  str = Query("", description="Same filter as /leads"),
    status:  str = Query("", description="Filter by status"),
    sort_by: str = Query("created_at"),
    order:   str = Query("desc"),
):
    """Stream filtered leads as a CSV file download."""
    db = SessionLocal()
    try:
        q = db.query(Lead)

        if search:
            like = f"%{search}%"
            q = q.filter(
                Lead.name.ilike(like) |
                Lead.company.ilike(like) |
                Lead.job_title.ilike(like) |
                Lead.location.ilike(like)
            )

        if status and status in LEAD_STATUSES:
            q = q.filter(Lead.status == status)

        valid_cols = {"id", "name", "company", "job_title", "location", "created_at", "status"}
        if sort_by not in valid_cols:
            sort_by = "created_at"
        col = getattr(Lead, sort_by)
        q   = q.order_by(col.desc() if order == "desc" else col.asc())

        leads = q.all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Name", "Email", "Company", "Job Title",
                         "Location", "Industry", "LinkedIn URL", "Status", "Notes", "Created At"])

        for l in leads:
            writer.writerow([
                l.id, l.name, l.email, l.company, l.job_title,
                l.location, l.industry, l.linkedin_url,
                l.status or "New", l.notes or "",
                l.created_at.isoformat() if l.created_at else "",
            ])

        output.seek(0)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=leads.csv"},
        )
    finally:
        db.close()


@app.post("/generate-email")
def generate_email(lead: EmailRequest):
    """Generate a personalized outreach email for a lead using Gemini (with template fallback)."""

    def template_email() -> dict:
        role    = lead.job_title or "professional"
        company = lead.company   or "your organization"
        subject = f"Quick note for {lead.name} at {company}"
        body = (
            f"Hi {lead.name},\n\n"
            f"I came across your profile and was impressed by your work as {role} at {company}. "
            f"I'd love to connect and explore whether there's a mutual fit between what we offer "
            f"and the challenges you may be facing.\n\n"
            f"Would you be open to a brief 15-minute call this week?\n\n"
            f"Looking forward to hearing from you.\n\nBest regards"
        )
        return {"subject": subject, "body": body}

    prompt = f"""
You are a professional B2B sales writer.
Write a short, personalized cold outreach email for the following lead.

Lead details:
- Name: {lead.name}
- Job Title: {lead.job_title or "N/A"}
- Company: {lead.company or "N/A"}
- Location: {lead.location or "N/A"}
- Industry: {lead.industry or "N/A"}

Return your response as valid JSON with exactly these two keys:
{{
  "subject": "...",
  "body": "..."
}}

Keep the email concise (under 150 words), professional, and specific to their role.
Do NOT include any explanation outside the JSON block.
"""

    try:
        raw = gemini_generate(prompt)
    except HTTPException:
        print("Gemini unavailable for email, using template fallback.")
        return template_email()

    cleaned = raw
    if cleaned.startswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[1:])
    if cleaned.endswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[:-1])

    try:
        parsed = json.loads(cleaned.strip())
        return {"subject": parsed["subject"], "body": parsed["body"]}
    except Exception:
        return template_email()


@app.get("/health")
def health():
    return {"status": "ok", "model": GEMINI_MODEL}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
