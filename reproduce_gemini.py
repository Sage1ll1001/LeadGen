import os
from google import genai
from dotenv import load_dotenv
import traceback

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
print("API Key loaded:", bool(GEMINI_API_KEY))

client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options={"api_version": "v1beta"}
)

try:
    print("Testing Gemini...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Say hello in one sentence.",
    )
    print("Response:", response.text)
except Exception:
    traceback.print_exc()
