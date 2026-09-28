import os
import json
import base64
from datetime import datetime, timezone
from pydantic import BaseModel
from google import genai
from google.genai import types
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_EMBEDDING_MODEL = os.environ.get("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

ai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None

class ExtractionResult(BaseModel):
    category: str
    colors: list[str]
    brand: str
    material: str
    distinguishing_features: str
    short_description: str
    normalized_location: str
    estimated_time: str

def extract_details(text: str, image_bytes: bytes = None) -> ExtractionResult:
    """Extracts structured information from text (and optionally an image)."""
    if not ai_client:
        return ExtractionResult(
            category="other", colors=[], brand="Unknown", material="Unknown",
            distinguishing_features="", short_description=text,
            normalized_location="Unknown", estimated_time="Unknown"
        )
        
    prompt = f"""
    Analyze the following item report. Extract the required fields and output STRICTLY as raw JSON.
    Format requirements:
    {{
      "category": "phone", // MUST be one of: phone, laptop, headphones, wallet, keys, id_card, backpack, bottle, umbrella, watch, other.
      "colors": ["grey"],
      "brand": "Unknown",
      "material": "Unknown",
      "distinguishing_features": "",
      "short_description": "A concise summary of the item itself (e.g., 'grey iPhone')",
      "normalized_location": "Unknown",
      "estimated_time": "Unknown"
    }}

    Text: {text}
    """
    
    contents = [prompt]
    if image_bytes:
        contents.append(
            types.Part.from_bytes(data=image_bytes, mime_type='image/jpeg')
        )
        
    import time
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = ai_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            import re
            # Clean potential markdown wrapping
            raw_text = response.text.strip()
            if raw_text.startswith('```'):
                raw_text = re.sub(r'^```json\s*', '', raw_text)
                raw_text = re.sub(r'\s*```$', '', raw_text)
                
            data = json.loads(raw_text)
            return ExtractionResult(**data)
        except Exception as e:
            print(f"Gemini generation error (attempt {attempt+1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                # Basic keyword fallback logic if all retries fail
                lower_text = text.lower()
                guessed_category = "other"
                categories = {
                    "phone": ["phone", "iphone", "samsung", "android"],
                    "laptop": ["laptop", "macbook", "computer", "thinkpad", "dell"],
                    "headphones": ["headphones", "airpods", "earbuds", "headset"],
                    "wallet": ["wallet", "purse"],
                    "keys": ["keys", "keychain"],
                    "id_card": ["id", "id_card", "card", "license"],
                    "backpack": ["backpack", "bag"],
                    "bottle": ["bottle", "flask", "hydroflask"],
                    "umbrella": ["umbrella"],
                    "watch": ["watch", "apple watch", "rolex"]
                }
                for cat, synonyms in categories.items():
                    if any(syn in lower_text for syn in synonyms):
                        guessed_category = cat
                        break
                
                # Guess colors
                colors = []
                for c in ["grey", "red", "black", "blue", "white", "silver", "gold"]:
                    if c in lower_text:
                        colors.append(c)

                return ExtractionResult(
                    category=guessed_category, colors=colors, brand="Unknown", material="Unknown",
                    distinguishing_features="", short_description=text[:50],
                    normalized_location="Unknown", estimated_time="Unknown"
                )

def generate_embedding(text: str) -> list[float]:
    """Generates a 768-dimensional embedding."""
    if not ai_client:
        return [0.0] * 768
    try:
        response = ai_client.models.embed_content(
            model=GEMINI_EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=768)
        )
        return response.embeddings[0].values
    except Exception as e:
        print(f"Embedding error: {e}")
        return [0.0] * 768

def build_embedding_text(extracted: ExtractionResult) -> str:
    parts = [
        f"Category: {extracted.category}",
        f"Brand: {extracted.brand}",
        f"Colors: {', '.join(extracted.colors)}",
        f"Features: {extracted.distinguishing_features}",
        f"Description: {extracted.short_description}"
    ]
    return " | ".join(parts)

def retrieve_candidates(vector: list[float], limit: int = 20):
    """Retrieve top N found items from Supabase."""
    if not supabase:
        return []
        
    # We call the RPC `match_found_reports`
    res = supabase.rpc('match_found_reports', {
        'query_embedding': vector,
        'match_threshold': 0.0,
        'match_count': limit,
        'time_limit': None
    }).execute()
    
    return res.data if res.data else []

def visual_rerank(lost_image_bytes: bytes, candidate_image_urls: list[str]) -> dict:
    """
    In a real app, this downloads candidate images and compares them to the lost_image.
    For this demo, we'll return a mock score modifier.
    """
    return {url: {"score": 80, "reason": "Visually similar"} for url in candidate_image_urls}

def score_match(candidate, extracted: ExtractionResult, has_image: bool) -> float:
    """
    Weights: 
    image similarity 40, description 20, category 15, colour 10, location 10, time 5.
    If no image, redistributes image weight to description.
    """
    score = 0.0
    
    # 1. Category (15)
    cand_cat = candidate.get('category', '').lower()
    ext_cat = extracted.category.lower()
    if cand_cat == ext_cat:
        score += 15
    elif ext_cat != 'other' and cand_cat != 'other':
        score -= 50
        
    # 2. Color (10)
    cand_colors = [c.lower() for c in candidate.get('colors', [])]
    match_colors = [c for c in extracted.colors if c.lower() in cand_colors]
    if match_colors:
        score += 10
        
    # 3. Description (Base 20, up to 60 if no image)
    desc_weight = 60 if not has_image else 20
    sim = float(candidate.get('similarity', 0)) # similarity from pgvector (0 to 1)
    # let's assume a sim of >0.5 is good.
    desc_score = max(0, min(desc_weight, sim * desc_weight))
    score += desc_score
    
    # 4. Location & Time are simplified for this demo
    score += 10 # Assuming location is near
    score += 5  # Assuming time is plausible
    
    return score

def run_matching_engine(text: str, image_bytes: bytes = None):
    # 1. Extract
    extracted = extract_details(text, image_bytes)
    
    # 2. Embed
    embed_text = build_embedding_text(extracted)
    vector = generate_embedding(embed_text)
    
    # 3. Retrieve
    candidates = retrieve_candidates(vector)
    
    # 4. Score
    results = []
    has_image = bool(image_bytes)
    for c in candidates:
        base_score = score_match(c, extracted, has_image)
        c['score'] = base_score
        c['explanation'] = "Matches basic criteria."
        results.append(c)
        
    # Sort by score
    results.sort(key=lambda x: x['score'], reverse=True)
    
    # 5. Visual re-rank on top 5
    top_5 = results[:5]
    if has_image:
        urls = [c.get('image_path') for c in top_5 if c.get('image_path')]
        visual_scores = visual_rerank(image_bytes, urls)
        for c in top_5:
            if c.get('image_path') in visual_scores:
                v = visual_scores[c['image_path']]
                # Add up to 40 points from visual similarity
                c['score'] += (v['score'] / 100.0) * 40
                c['explanation'] += f" Visual match: {v['reason']}."
                
    # Re-sort after visual re-rank
    results.sort(key=lambda x: x['score'], reverse=True)
    return extracted, results
