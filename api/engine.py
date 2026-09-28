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

def clean_env(val: str | None) -> str:
    if not val:
        return ""
    return val.replace('\ufeff', '').replace('\u200b', '').strip().strip('\'"')

GEMINI_API_KEY = clean_env(os.environ.get("GEMINI_API_KEY")) or None
GEMINI_MODEL = clean_env(os.environ.get("GEMINI_MODEL")) or "gemini-flash-latest"
GEMINI_EMBEDDING_MODEL = clean_env(os.environ.get("GEMINI_EMBEDDING_MODEL")) or "gemini-embedding-001"
SUPABASE_URL = clean_env(os.environ.get("SUPABASE_URL")) or None
SUPABASE_KEY = (
    clean_env(os.environ.get("SUPABASE_SERVICE_ROLE_KEY")) or
    clean_env(os.environ.get("SUPABASE_SECRET_KEY")) or
    clean_env(os.environ.get("SUPABASE_KEY")) or
    None
)

ai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Supabase client init error: {e}")

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
        
    try:
        response = ai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        import re
        raw_text = response.text.strip()
        if raw_text.startswith('```'):
            raw_text = re.sub(r'^```json\s*', '', raw_text)
            raw_text = re.sub(r'\s*```$', '', raw_text)
            
        data = json.loads(raw_text)
        return ExtractionResult(**data)
    except Exception as e:
        print(f"Gemini generation error: {e}. Falling back to instant rule-based extraction.")
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
        
    try:
        res = supabase.rpc('match_found_reports', {
            'query_embedding': vector,
            'match_threshold': 0.0,
            'match_count': limit,
            'time_limit': None
        }).execute()
        return res.data if res.data else []
    except Exception as e:
        print(f"Supabase RPC match_found_reports error: {e}. Falling back to select query.")
        try:
            fallback_res = supabase.table('found_reports').select('*').limit(limit).execute()
            return fallback_res.data if fallback_res.data else []
        except Exception as e2:
            print(f"Supabase fallback query error: {e2}")
            return []

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
    import math
    try:
        raw_sim = candidate.get('similarity', 0)
        sim = float(raw_sim) if raw_sim is not None else 0.0
        if math.isnan(sim) or math.isinf(sim):
            sim = 0.0
    except (ValueError, TypeError):
        sim = 0.0

    desc_score = max(0.0, min(float(desc_weight), sim * desc_weight))
    score += desc_score
    
    # 4. Location & Time are simplified for this demo
    score += 10 # Assuming location is near
    score += 5  # Assuming time is plausible
    
    return score

def run_matching_engine(text: str, image_bytes: bytes = None):
    import math
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
        for k, v in list(c.items()):
            try:
                if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                    c[k] = 0.0
                elif str(v).lower() == 'nan':
                    c[k] = 0.0
            except Exception:
                pass
        base_score = score_match(c, extracted, has_image)
        c['score'] = round(float(base_score), 1)
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
