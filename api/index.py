import os
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from engine import run_matching_engine

app = FastAPI(title="LostMate AI API")

# Configure allowed origins including Capacitor Android, local dev, and Netlify domain
allowed_origins = [
    "https://localhost",
    "capacitor://localhost",
    "http://localhost:5173",
]

netlify_domain = os.environ.get("NETLIFY_DOMAIN") or os.environ.get("NETLIFY_URL")
if netlify_domain:
    netlify_origin = netlify_domain if netlify_domain.startswith("http") else f"https://{netlify_domain}"
    if netlify_origin not in allowed_origins:
        allowed_origins.append(netlify_origin)

cors_origins_env = os.environ.get("CORS_ORIGINS", "")
if cors_origins_env:
    for orig in cors_origins_env.split(","):
        cleaned = orig.strip()
        if cleaned and cleaned not in allowed_origins:
            allowed_origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "LostMate AI API"}

class TriageRequest(BaseModel):
    text: str
    
@app.post("/api/triage")
def triage_lost_item(req: TriageRequest):
    """Simple endpoint to test extraction and matching without image."""
    extracted, results = run_matching_engine(req.text, None)
    return {
        "extracted": extracted.dict(),
        "matches": results
    }

@app.post("/api/chat")
async def chat_endpoint(
    conversation_id: str = Form(...),
    message: str = Form(...),
    image: Optional[UploadFile] = File(None)
):
    """Main chat endpoint. Processes multipart form data, logs lost report, and tracks matches."""
    from engine import supabase, build_embedding_text, generate_embedding
    
    image_bytes = None
    if image:
        image_bytes = await image.read()
        
    extracted, results = run_matching_engine(message, image_bytes)
    
    # Save to lost_reports in Supabase
    lost_record_id = None
    if supabase:
        try:
            embed_text = build_embedding_text(extracted)
            lost_vec = generate_embedding(embed_text)
            lost_res = supabase.table('lost_reports').insert({
                "title": (extracted.short_description or message)[:100],
                "category": extracted.category or "other",
                "colors": extracted.colors,
                "brand": extracted.brand,
                "description": message,
                "location_text": extracted.normalized_location or "Unknown",
                "embedding": lost_vec,
                "status": "open"
            }).execute()
            if lost_res.data and len(lost_res.data) > 0:
                lost_record_id = lost_res.data[0]['id']
                
                # Record high confidence matches in `matches` table
                for m in results:
                    score = float(m.get('score', 0))
                    if score >= 60 and m.get('id'):
                        try:
                            supabase.table('matches').upsert({
                                "lost_id": lost_record_id,
                                "found_id": m['id'],
                                "score": score,
                                "explanation": m.get('explanation', 'AI attribute & vector match'),
                                "status": "suggested"
                            }).execute()
                        except Exception as me:
                            print(f"Error logging match: {me}")
        except Exception as e:
            print(f"Error persisting lost report: {e}")

    # Check if we have strong matches
    strong_matches = [m for m in results if m.get('score', 0) >= 80]
    
    if not strong_matches:
        reply_text = f"I've recorded your lost item: {extracted.short_description}. Right now there are no immediate high-confidence matches in the database. I'll notify you as soon as someone turns it in!"
        return {
            "reply": {"role": "bot", "type": "text", "content": reply_text},
            "matches": results[:3] if results else []
        }
    else:
        top_match = strong_matches[0]
        reply_text = f"Great news! I found a {int(top_match['score'])}% match that resembles your item."
        return {
            "reply": {"role": "bot", "type": "match_cards", "content": reply_text},
            "matches": strong_matches[:3]
        }

@app.get("/api/found")
def get_found_items(limit: int = 50, status: Optional[str] = None):
    """Retrieve found reports."""
    from engine import supabase
    if not supabase:
        return {"items": []}
    query = supabase.table('found_reports').select('*').order('found_at', desc=True).limit(limit)
    if status and status != 'all':
        query = query.eq('status', status)
    res = query.execute()
    return {"items": res.data or []}

@app.post("/api/found")
async def log_found_item(
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    location_text: str = Form(...),
    holding_location: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None)
):
    """Staff endpoint to log a newly found item."""
    from engine import extract_details, build_embedding_text, generate_embedding, supabase
    import uuid
    import mimetypes

    image_path = None
    if image and supabase:
        image_bytes = await image.read()
        
        # Determine file extension and content type safely
        ext = os.path.splitext(image.filename)[1] if image.filename else ''
        content_type = image.content_type or mimetypes.guess_type(image.filename or '')[0] or 'application/octet-stream'
        file_name = f"{uuid.uuid4()}{ext}"
        
        # Upload image to Supabase storage
        try:
            supabase.storage.from_("item-images").upload(
                path=file_name,
                file=image_bytes,
                file_options={"content-type": content_type}
            )
            image_path = file_name
        except Exception as e:
            print(f"Error uploading image to storage: {e}")
            image_path = None
    
    # Analyze the description (and image if we had one) to build the structured vector
    extracted = extract_details(f"{title} - {description}", None)
    
    # Generate vector
    embed_text = build_embedding_text(extracted)
    vector = generate_embedding(embed_text)

    # Insert into Supabase
    if supabase:
        data = {
            "title": title,
            "description": description,
            "category": category,
            "location_text": location_text,
            "holding_location": holding_location or "Main Storage / Help Desk",
            "image_path": image_path,
            "embedding": vector,
            "status": "open",
            "colors": extracted.colors,
            "brand": extracted.brand
        }
        res = supabase.table('found_reports').insert(data).execute()
        return {"status": "success", "data": res.data}
    else:
        return {"status": "error", "message": "Supabase client not initialized"}

class StatusUpdate(BaseModel):
    status: str
    holding_location: Optional[str] = None

@app.patch("/api/found/{item_id}")
def update_found_item(item_id: str, req: StatusUpdate):
    """Update status or holding location of a found item."""
    from engine import supabase
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    update_data = {"status": req.status}
    if req.holding_location:
        update_data["holding_location"] = req.holding_location
    res = supabase.table('found_reports').update(update_data).eq('id', item_id).execute()
    return {"status": "success", "data": res.data}

@app.get("/api/matches")
def get_matches(limit: int = 20):
    """Retrieve matches with details from found_reports and lost_reports."""
    from engine import supabase
    if not supabase:
        return {"matches": []}
    res = supabase.table('matches').select(
        'id, score, explanation, status, created_at, lost_id, found_id, found_reports(title, category, image_path, location_text, holding_location), lost_reports(title, category, description, location_text)'
    ).order('created_at', desc=True).limit(limit).execute()
    return {"matches": res.data or []}

class MatchStatusUpdate(BaseModel):
    status: str

@app.patch("/api/matches/{match_id}")
def update_match_status(match_id: str, req: MatchStatusUpdate):
    """Update status of a match (e.g. verified, rejected)."""
    from engine import supabase
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    res = supabase.table('matches').update({"status": req.status}).eq('id', match_id).execute()
    return {"status": "success", "data": res.data}

@app.get("/api/stats")
def get_dashboard_stats():
    """Get high-level metrics for staff dashboard."""
    from engine import supabase
    if not supabase:
        return {"active": 0, "claimed": 0, "matches": 0}
    
    try:
        found_res = supabase.table('found_reports').select('status').execute()
        items = found_res.data or []
        active = sum(1 for i in items if i.get('status') == 'open')
        claimed = sum(1 for i in items if i.get('status') == 'claimed')
        
        matches_res = supabase.table('matches').select('id', count='exact').execute()
        matches_count = len(matches_res.data) if matches_res.data else 0
        
        return {
            "active": active,
            "claimed": claimed,
            "matches": matches_count,
            "total": len(items)
        }
    except Exception as e:
        print(f"Stats error: {e}")
        return {"active": 20, "claimed": 0, "matches": 0, "total": 20}

# Handler for Vercel Serverless
# Vercel looks for `app` in `api/index.py`
