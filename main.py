import os
import json
import requests

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from sqlalchemy import create_engine, Column, String, Integer
from sqlalchemy.orm import declarative_base, sessionmaker

# =========================
# Load ENV
# =========================
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
APIFY_TOKEN = os.getenv("APIFY_API_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")

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


# =========================
# Database Setup
# =========================
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String)
    title = Column(String)
    company = Column(String)
    location = Column(String)

Base.metadata.create_all(bind=engine)

# =========================
# FastAPI App
# =========================
app = FastAPI()

class LeadQuery(BaseModel):
    query: str


# =========================
# Step 1 - Convert Query to Filters (Gemini)
# =========================
def convert_query_to_google_query(query: str):
    prompt = f"""
    Convert this query into a Google search query 
    to find LinkedIn profiles.

    Only return the search query string.
    No explanation.

    Example:
    Input: CEO in Mumbai
    Output: site:linkedin.com/in "CEO" "Mumbai"

    Query: {query}
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        search_query = response.text.strip()
        print("Generated Google query:", search_query)

        return search_query

    except Exception as e:
        print("Gemini error:", e)
        raise HTTPException(status_code=500, detail="Gemini failed")

# =========================
# Step 2 - Fetch Leads from Apify
# =========================
def fetch_leads(search_query):
    url = f"https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token={APIFY_TOKEN}"

    payload = {
        "queries": search_query,
        "maxPagesPerQuery": 1
    }

    try:
        response = requests.post(url, json=payload)

        print("Apify status:", response.status_code)

        if response.status_code != 200 and response.status_code != 201:
            raise HTTPException(status_code=500, detail="Apify API failed")

        results = response.json()

        if not results:
            return []

        organic_results = results[0].get("organicResults", [])

        leads = []

        for item in organic_results:
            link = item.get("url", "")

            if "linkedin.com/in" in link:
                personal_info = item.get("personalInfo", {})

                leads.append({
                    "name": item.get("title"),
                    "title": personal_info.get("jobTitle"),
                    "email": None,
                    "organization": {
                        "name": personal_info.get("companyName")
                    },
                    "location": personal_info.get("location"),
                    "linkedin_url": link
                })

        return leads

    except Exception as e:
        print("Apify exception:", e)
        raise HTTPException(status_code=500, detail="Apify request failed")

# =========================
# Step 3 - Store Leads in DB
# =========================
def store_leads(leads):
    db = SessionLocal()

    try:
        for lead in leads:
            new_lead = Lead(
                name=lead.get("name"),
                email=lead.get("email"),
                title=lead.get("title"),
                company=lead.get("organization", {}).get("name"),
                location=lead.get("organization", {}).get("location")
            )
            db.add(new_lead)

        db.commit()

    except Exception as e:
        db.rollback()
        print("DB error:", e)
        raise HTTPException(status_code=500, detail="Database error")

    finally:
        db.close()


# =========================
# API Endpoint
# =========================
@app.post("/generate-leads")
def generate_leads(data: LeadQuery):
    print("Incoming query:", data.query)

    search_query = convert_query_to_google_query(data.query)

    leads = fetch_leads(search_query)

    if not isinstance(leads, list):
        raise HTTPException(status_code=500, detail="Invalid format")

    store_leads(leads)

    return {
        "google_query": search_query,
        "leads_found": len(leads)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
