import os
import json
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

# Use the official google-genai SDK as requested
from google import genai
from google.genai import types

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
EMBEDDING_MODEL = os.environ.get("GEMINI_EMBEDDING_MODEL", "text-embedding-004")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing Supabase credentials in .env")
    exit(1)

if not GEMINI_API_KEY:
    print("Missing GEMINI_API_KEY in .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
# Initialize the new Google GenAI client
ai_client = genai.Client(api_key=GEMINI_API_KEY)

def generate_embedding(text: str) -> list[float]:
    """Generates a 768-dimensional embedding using Gemini."""
    try:
        response = ai_client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=768)
        )
        # return the first embedding array
        return response.embeddings[0].values
    except Exception as e:
        print(f"Error generating embedding for text '{text}': {e}")
        # fallback to a zero vector for demo purposes if API fails
        return [0.0] * 768

SEED_REPORTS = [
    {
        "title": "Black Sony Over-Ear Headphones",
        "category": "headphones",
        "colors": ["black"],
        "brand": "Sony",
        "description": "Black over-ear headphones, model WH-1000XM4, slightly scratched on the left side.",
        "location_text": "Near Gate 7",
        "found_at_offset_hours": -1,  # found 1 hour ago
        "holding_location": "Terminal 1 Security Desk",
        "image_path": "headphones.jpg"
    },
    {
        "title": "Brown Leather Wallet",
        "category": "wallet",
        "colors": ["brown"],
        "brand": "Fossil",
        "description": "Men's bifold brown leather wallet, contains some cash and transit cards.",
        "location_text": "Food Court Table 12",
        "found_at_offset_hours": -5,
        "holding_location": "Main Info Desk",
        "image_path": "wallet.jpg"
    },
    {
        "title": "Keys with a blue lanyard",
        "category": "keys",
        "colors": ["blue", "silver"],
        "brand": "Toyota",
        "description": "Car key fob with three house keys attached to a blue lanyard.",
        "location_text": "Parking Lot B, Row 4",
        "found_at_offset_hours": -24,
        "holding_location": "Security Office",
        "image_path": "keys.jpg"
    },
    {
        "title": "Hydroflask Water Bottle",
        "category": "bottle",
        "colors": ["teal"],
        "brand": "Hydro Flask",
        "description": "Teal 32oz insulated water bottle with several travel stickers.",
        "location_text": "Library 2nd Floor",
        "found_at_offset_hours": -48,
        "holding_location": "Library Circulation Desk",
        "image_path": "bottle.jpg"
    },
    {
        "title": "Student ID Card - John Doe",
        "category": "id_card",
        "colors": ["white", "blue"],
        "brand": "University",
        "description": "Campus ID card for a student named John Doe.",
        "location_text": "Main Quad path",
        "found_at_offset_hours": -2,
        "holding_location": "Student Union Desk",
        "image_path": "id_card.jpg"
    },
    {
        "title": "Grey North Face Backpack",
        "category": "backpack",
        "colors": ["grey", "black"],
        "brand": "The North Face",
        "description": "Grey commuter backpack, quite heavy, has a red zipper pull.",
        "location_text": "Lecture Hall 101",
        "found_at_offset_hours": -6,
        "holding_location": "Campus Police",
        "image_path": "backpack.jpg"
    },
    {
        "title": "iPhone 13 Pro Max",
        "category": "phone",
        "colors": ["blue"],
        "brand": "Apple",
        "description": "Sierra Blue iPhone in a clear case. Lock screen shows a dog.",
        "location_text": "Restroom near Food Court",
        "found_at_offset_hours": -12,
        "holding_location": "Main Info Desk",
        "image_path": "phone.jpg"
    },
    {
        "title": "Black Folding Umbrella",
        "category": "umbrella",
        "colors": ["black"],
        "brand": "Totes",
        "description": "Compact black folding umbrella with a wooden handle.",
        "location_text": "Entrance Lobby",
        "found_at_offset_hours": -3,
        "holding_location": "Lobby Security",
        "image_path": "umbrella.jpg"
    }
]

# Generate more dummy items to reach 20 total
categories = ["headphones", "wallet", "keys", "bottle", "id_card", "backpack", "phone", "umbrella"]
for i in range(12):
    cat = categories[i % len(categories)]
    SEED_REPORTS.append({
        "title": f"Lost {cat.capitalize()} #{i+1}",
        "category": cat,
        "colors": ["mixed"],
        "brand": "Unknown",
        "description": f"A found item categorized as {cat}.",
        "location_text": "Various locations",
        "found_at_offset_hours": - (i * 10),
        "holding_location": "Storage Room A",
        "image_path": f"{cat}_{i}.jpg"
    })

def build_embedding_text(report: dict) -> str:
    """Concatenate fields to form the string we will embed."""
    parts = [
        f"Category: {report['category']}",
        f"Title: {report['title']}",
        f"Brand: {report.get('brand', 'Unknown')}",
        f"Colors: {', '.join(report.get('colors', []))}",
        f"Description: {report.get('description', '')}"
    ]
    return " | ".join(parts)

async def main():
    print("Starting database seed...")
    
    # 1. Clean existing found reports (optional, for idempotency)
    # supabase.table("found_reports").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    
    now = datetime.now(timezone.utc)
    
    for report in SEED_REPORTS:
        print(f"Processing: {report['title']}")
        
        # Build text and generate embedding
        text_to_embed = build_embedding_text(report)
        vector = generate_embedding(text_to_embed)
        
        # Calculate found time
        found_at = now + timedelta(hours=report["found_at_offset_hours"])
        
        # Insert into Supabase
        data = {
            "title": report["title"],
            "category": report["category"],
            "colors": report["colors"],
            "brand": report["brand"],
            "description": report["description"],
            "location_text": report["location_text"],
            "found_at": found_at.isoformat(),
            "holding_location": report["holding_location"],
            "image_path": report["image_path"],
            "embedding": vector,
            "status": "open"
        }
        
        res = supabase.table("found_reports").insert(data).execute()
        if res.data:
            print(f"Inserted: {res.data[0]['id']}")
        else:
            print(f"Failed to insert: {report['title']}")

    print("Seed complete! You should manually upload images to your 'item-images' Supabase storage bucket.")

if __name__ == "__main__":
    asyncio.run(main())
