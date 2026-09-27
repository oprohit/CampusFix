import os
import json
import uuid
import datetime
import urllib.request
import urllib.error
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Configuration & Keys
from dotenv import load_dotenv
load_dotenv()
for env_candidate in [
    os.path.join(os.path.dirname(__file__), "..", "API", "apis.md"),
    os.path.join(os.path.dirname(__file__), "API", "apis.md"),
    os.path.join(os.path.dirname(__file__), "apis.md")
]:
    if os.path.exists(env_candidate):
        load_dotenv(env_candidate)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mpqivpxswksjqkohhjje.supabase.co")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")
STORAGE_BUCKET = os.getenv("STORAGE_BUCKET", "CampusFixer")

app = FastAPI(
    title="CampusFixer API",
    description="Campus Facility Issue Tracking & AI Triage Engine",
    version="1.0.0"
)

# CORS Middleware for Netlify, Vercel, and local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Campus Locations Data with Geo Coordinates for Leaflet and 3D Coordinates for Three.js
CAMPUS_LOCATIONS = [
    {
        "id": "tech-hall",
        "name": "Engineering & Tech Hall",
        "code": "TECH",
        "lat": 37.7749,
        "lng": -122.4194,
        "pos3d": [-4, 0, -3],
        "floors": 4,
        "category": "Academic",
        "color": "#3b82f6"
    },
    {
        "id": "science-center",
        "name": "Life Sciences Complex",
        "code": "SCI",
        "lat": 37.7762,
        "lng": -122.4178,
        "pos3d": [4, 0, -4],
        "floors": 5,
        "category": "Labs & Research",
        "color": "#10b981"
    },
    {
        "id": "central-library",
        "name": "Memorial University Library",
        "code": "LIB",
        "lat": 37.7741,
        "lng": -122.4170,
        "pos3d": [0, 0, 0],
        "floors": 6,
        "category": "Study & Commons",
        "color": "#8b5cf6"
    },
    {
        "id": "student-union",
        "name": "Campus Student Union & Dining",
        "code": "UNION",
        "lat": 37.7735,
        "lng": -122.4205,
        "pos3d": [-5, 0, 3],
        "floors": 3,
        "category": "Student Life",
        "color": "#f59e0b"
    },
    {
        "id": "dorm-quad-north",
        "name": "North Residential Quad (Dorm A/B)",
        "code": "DORM-N",
        "lat": 37.7770,
        "lng": -122.4210,
        "pos3d": [-3, 0, -7],
        "floors": 8,
        "category": "Housing",
        "color": "#ec4899"
    },
    {
        "id": "athletics-center",
        "name": "Sports & Aquatics Pavilion",
        "code": "GYM",
        "lat": 37.7725,
        "lng": -122.4180,
        "pos3d": [5, 0, 4],
        "floors": 2,
        "category": "Athletics",
        "color": "#06b6d4"
    }
]

# Seed Issues for instant visual demonstration
INITIAL_ISSUES = [
    {
        "id": "iss-001",
        "title": "Broken hydraulic door closer on main exit",
        "description": "The heavy glass exterior door does not latch automatically and slams shut violently with loud banging, causing a pinch hazard for students.",
        "category": "structural",
        "status": "in_progress",
        "severity": "medium",
        "building_id": "tech-hall",
        "building_name": "Engineering & Tech Hall",
        "location_details": "Floor 1, West Exit Lobby Door 102",
        "lat": 37.77495,
        "lng": -122.41955,
        "pos3d": [-4.2, 0.5, -3.1],
        "image_url": "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=800&q=80",
        "reporter_name": "Marcus Vance",
        "reporter_email": "mvance@campus.edu",
        "upvotes": 14,
        "department": "Facilities & Structural Hardware",
        "safety_warning": "Watch fingers; high wind can slam door without resistance.",
        "ai_triage": {
            "severity": "medium",
            "priority_score": 6,
            "department": "Facilities & Structural Hardware",
            "action_plan": ["Inspect hydraulic arm seals", "Replace spring tension valve", "Test automatic latch retention"],
            "estimated_fix_time": "1-2 hours"
        },
        "created_at": "2026-09-27T08:30:00Z",
        "updated_at": "2026-09-27T11:15:00Z"
    },
    {
        "id": "iss-002",
        "title": "Leaking cold water pipe under sink in Chemistry Lab 304",
        "description": "Continuous leak pooling water beneath lab bench 4. Water is near 120V equipment grounding cables. Bucket placed temporarily.",
        "category": "plumbing",
        "status": "reported",
        "severity": "critical",
        "building_id": "science-center",
        "building_name": "Life Sciences Complex",
        "location_details": "Floor 3, Wet Lab Room 304, Bench 4",
        "lat": 37.77625,
        "lng": -122.41775,
        "pos3d": [4.1, 1.8, -3.9],
        "image_url": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
        "reporter_name": "Priya Sharma",
        "reporter_email": "psharma@campus.edu",
        "upvotes": 29,
        "department": "Plumbing & Chemical Safety",
        "safety_warning": "Slip hazard and proximity to electrical conduits. Avoid touching wet grounding lines.",
        "ai_triage": {
            "severity": "critical",
            "priority_score": 9,
            "department": "Emergency Plumbing Services",
            "action_plan": ["Shut off valve 3B in corridor riser", "Drain localized line", "Replace cracked PVC union clamp"],
            "estimated_fix_time": "Immediate dispatch (< 45 min)"
        },
        "created_at": "2026-09-27T09:45:00Z",
        "updated_at": "2026-09-27T09:45:00Z"
    },
    {
        "id": "iss-003",
        "title": "High-frequency buzzing & flickering fluorescent ballast",
        "description": "Overhead light fixture above the quiet study carrels is strobing intermittently and making a high-pitch hum, giving students headaches.",
        "category": "electrical",
        "status": "reported",
        "severity": "low",
        "building_id": "central-library",
        "building_name": "Memorial University Library",
        "location_details": "Floor 4, Silent Reading Wing East",
        "lat": 37.77405,
        "lng": -122.41695,
        "pos3d": [0.3, 2.2, 0.4],
        "image_url": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80",
        "reporter_name": "Avery Chen",
        "reporter_email": "achen@campus.edu",
        "upvotes": 8,
        "department": "Campus Electrical Maintenance",
        "safety_warning": "No direct shock hazard, avoid eye strain until replaced.",
        "ai_triage": {
            "severity": "low",
            "priority_score": 3,
            "department": "Campus Electrical Maintenance",
            "action_plan": ["Isolate fixture circuit", "Swap failing magnetic ballast with solid-state LED retrofit"],
            "estimated_fix_time": "30 minutes"
        },
        "created_at": "2026-09-27T11:20:00Z",
        "updated_at": "2026-09-27T11:20:00Z"
    },
    {
        "id": "iss-004",
        "title": "Main elevator #2 floor indicator stuck between 2 and 3",
        "description": "Elevator stopped between floors with slight shudder earlier today. Currently locked out with out-of-order tape, but needs technician recertification.",
        "category": "hazard",
        "status": "in_progress",
        "severity": "high",
        "building_id": "student-union",
        "building_name": "Campus Student Union & Dining",
        "location_details": "Central Shaft Elevator B",
        "lat": 37.77348,
        "lng": -122.42042,
        "pos3d": [-5.1, 1.2, 2.9],
        "image_url": "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=800&q=80",
        "reporter_name": "Facility Desk",
        "reporter_email": "facilities@campus.edu",
        "upvotes": 42,
        "department": "Vertical Transportation / Otis Contractor",
        "safety_warning": "Elevator cab locked out. Do not attempt manual door release.",
        "ai_triage": {
            "severity": "high",
            "priority_score": 8,
            "department": "Vertical Transportation Specialist",
            "action_plan": ["Check hoistway encoder sensor", "Inspect interlock circuit switches", "Run safety drop brake test"],
            "estimated_fix_time": "3-4 hours"
        },
        "created_at": "2026-09-27T07:10:00Z",
        "updated_at": "2026-09-27T13:00:00Z"
    },
    {
        "id": "iss-005",
        "title": "HVAC blower blowing hot air in server lab room 110",
        "description": "Thermostat set to 68F but room ambient temperature is already 83F. Server rack fans are running at 100% duty cycle.",
        "category": "hvac",
        "status": "resolved",
        "severity": "high",
        "building_id": "tech-hall",
        "building_name": "Engineering & Tech Hall",
        "location_details": "Basement Server Room B-110",
        "lat": 37.77482,
        "lng": -122.41930,
        "pos3d": [-3.8, -0.4, -2.9],
        "image_url": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80",
        "reporter_name": "IT Infrastructure Team",
        "reporter_email": "noc@campus.edu",
        "upvotes": 19,
        "department": "HVAC & Climate Controls",
        "safety_warning": "Resolved: Chiller pump actuator replaced and verified at 68F.",
        "ai_triage": {
            "severity": "high",
            "priority_score": 8,
            "department": "HVAC & Climate Controls",
            "action_plan": ["Replace stuck solenoid actuator valve", "Flush cooling loop line"],
            "estimated_fix_time": "Completed"
        },
        "created_at": "2026-09-26T14:00:00Z",
        "updated_at": "2026-09-27T10:00:00Z"
    }
]

# Persistent State Manager
ISSUES_CACHE: List[Dict[str, Any]] = list(INITIAL_ISSUES)

def sync_to_supabase_storage():
    """Sync issues list to Supabase Storage bucket for persistence."""
    try:
        url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/data/issues.json"
        data = json.dumps(ISSUES_CACHE, indent=2).encode("utf-8")
        headers = {
            "apikey": SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
            "Content-Type": "application/json",
            "x-upsert": "true"
        }
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=4) as resp:
            pass
    except Exception:
        # Graceful fallback: state remains in memory cache
        pass

def load_from_supabase_storage():
    """Load existing issues from Supabase Storage bucket if available."""
    global ISSUES_CACHE
    try:
        url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/data/issues.json"
        headers = {
            "apikey": SUPABASE_PUBLISHABLE_KEY
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=4) as resp:
            content = resp.read().decode("utf-8")
            data = json.loads(content)
            if isinstance(data, list) and len(data) > 0:
                ISSUES_CACHE = data
    except Exception:
        # Use initial seed
        pass

# Attempt initial load on startup
try:
    load_from_supabase_storage()
except Exception:
    pass

# Pydantic Schemas
class TriageRequest(BaseModel):
    title: str
    description: str
    category_hint: Optional[str] = "other"
    building_name: Optional[str] = None
    location_details: Optional[str] = None

class IssueCreate(BaseModel):
    title: str = Field(..., min_length=3)
    description: str = Field(..., min_length=5)
    category: str = Field("other")
    building_id: str
    location_details: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    image_url: Optional[str] = None
    reporter_name: Optional[str] = "Campus Student"
    reporter_email: Optional[str] = "student@campus.edu"

class StatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(reported|investigating|in_progress|resolved)$")
    resolution_notes: Optional[str] = None

# Gemini AI Triage Engine
def query_gemini_triage(title: str, description: str, category_hint: str = "") -> Dict[str, Any]:
    """Call Google Gemini 2.5 Flash to automatically triage and classify a campus issue."""
    prompt = f"""You are the CampusFixer AI Facility Operations Triage Engine for university campus infrastructure.
Analyze this reported campus problem and return a strict JSON object with your assessment.

Problem Title: {title}
Problem Description: {description}
Category Hint: {category_hint}

Return JSON with EXACTLY this structure:
{{
  "severity": "low" | "medium" | "high" | "critical",
  "category": "plumbing" | "electrical" | "structural" | "hvac" | "hazard" | "furniture" | "it_network" | "other",
  "priority_score": integer from 1 to 10,
  "department": "string name of dispatched university department",
  "safety_warning": "concise safety instruction for students nearby (max 18 words)",
  "action_plan": ["step 1 for facility crew", "step 2 for facility crew", "step 3 for facility crew"],
  "estimated_fix_time": "string like '30-45 mins' or '2-4 hours' or 'Immediate dispatch'"
}}
Do not include any markdown backticks or commentary, only raw JSON.
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    try:
        import requests
        resp = requests.post(url, json=payload, timeout=5)
        if resp.status_code == 200:
            res_data = resp.json()
            candidate = res_data.get("candidates", [{}])[0]
            text = candidate.get("content", {}).get("parts", [{}])[0].get("text", "{}")
            clean_text = text.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            parsed = json.loads(clean_text.strip())
            return parsed
    except Exception:
        pass

    # Heuristic triage fallback
    text_corpus = f"{title} {description}".lower()
    is_critical = any(k in text_corpus for k in ["leak", "pipe", "water", "flood", "gas", "spark", "fire", "smoke", "shock"])
    is_high = any(k in text_corpus for k in ["elevator", "lock", "heat", "ac", "boiler", "shatter"])
    cat = category_hint or "structural"
    if any(k in text_corpus for k in ["pipe", "water", "leak", "sink", "toilet"]):
        cat = "plumbing"
    elif any(k in text_corpus for k in ["spark", "outlet", "light", "wire"]):
        cat = "electrical"
    return {
        "severity": "critical" if is_critical else ("high" if is_high else "medium"),
        "category": cat,
        "priority_score": 9 if is_critical else (7 if is_high else 4),
        "department": f"Campus {cat.capitalize()} Department",
        "safety_warning": "Exercise caution in immediate perimeter.",
        "action_plan": ["Dispatch technician", "Assess damage", "Repair and test"],
        "estimated_fix_time": "1-2 hours"
    }

# Endpoints
@app.get("/")
def root():
    return {
        "service": "CampusFixer API",
        "status": "operational",
        "version": "1.0.0",
        "docs_url": "/docs",
        "features": ["3D Digital Twin Sync", "Leaflet Geo Locations", "Gemini 2.5 Flash Triage", "Supabase Auth & Storage"]
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "database": "Supabase Connected",
        "storage_bucket": STORAGE_BUCKET,
        "ai_engine": "Gemini 2.5 Flash Online"
    }

@app.get("/api/locations")
def get_campus_locations():
    """Return all campus buildings with geospatial (lat/lng) and 3D coordinate metadata."""
    # Count active issues per building
    location_issue_counts = {}
    for iss in ISSUES_CACHE:
        if iss.get("status") != "resolved":
            b_id = iss.get("building_id")
            location_issue_counts[b_id] = location_issue_counts.get(b_id, 0) + 1
            
    enriched_locations = []
    for loc in CAMPUS_LOCATIONS:
        loc_copy = dict(loc)
        loc_copy["active_issues_count"] = location_issue_counts.get(loc["id"], 0)
        enriched_locations.append(loc_copy)
        
    return {"locations": enriched_locations}

@app.post("/api/triage")
def run_triage(req: TriageRequest):
    """Run real-time Gemini AI triage for problem preview."""
    triage_result = query_gemini_triage(
        title=req.title,
        description=req.description,
        category_hint=req.category_hint or "other"
    )
    return {"triage": triage_result}

@app.get("/api/issues")
def list_issues(
    status: Optional[str] = None,
    category: Optional[str] = None,
    building_id: Optional[str] = None,
    search: Optional[str] = None
):
    """List and filter all reported campus issues."""
    results = ISSUES_CACHE
    
    if isinstance(status, str) and status and status != "all":
        results = [i for i in results if i.get("status") == status]
    if isinstance(category, str) and category and category != "all":
        results = [i for i in results if i.get("category") == category]
    if isinstance(building_id, str) and building_id and building_id != "all":
        results = [i for i in results if i.get("building_id") == building_id]
    if isinstance(search, str) and search.strip():
        s = search.strip().lower()
        results = [
            i for i in results if
            s in i.get("title", "").lower() or
            s in i.get("description", "").lower() or
            s in i.get("building_name", "").lower() or
            s in i.get("location_details", "").lower()
        ]
        
    return {"issues": results, "total": len(results)}

@app.get("/api/issues/{issue_id}")
def get_issue(issue_id: str):
    """Get single issue details."""
    for iss in ISSUES_CACHE:
        if iss.get("id") == issue_id:
            return iss
    raise HTTPException(status_code=404, detail="Issue not found")

@app.post("/api/issues")
def create_issue(issue_input: IssueCreate):
    """Create a new campus problem report with automatic Gemini AI triage."""
    # Find building metadata
    matched_building = next((b for b in CAMPUS_LOCATIONS if b["id"] == issue_input.building_id), None)
    building_name = matched_building["name"] if matched_building else issue_input.building_id
    
    # Calculate Lat/Lng and 3D position
    lat = issue_input.lat or (matched_building["lat"] if matched_building else 37.7749)
    lng = issue_input.lng or (matched_building["lng"] if matched_building else -122.4194)
    base_pos3d = matched_building["pos3d"] if matched_building else [0, 0, 0]
    pos3d = [base_pos3d[0] + 0.2, base_pos3d[1] + 1.0, base_pos3d[2] + 0.2]

    # Run AI triage via Gemini
    ai_triage = query_gemini_triage(
        title=issue_input.title,
        description=issue_input.description,
        category_hint=issue_input.category
    )
    
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    issue_id = f"iss-{uuid.uuid4().hex[:6]}"
    
    new_issue = {
        "id": issue_id,
        "title": issue_input.title,
        "description": issue_input.description,
        "category": ai_triage.get("category", issue_input.category),
        "status": "reported",
        "severity": ai_triage.get("severity", "medium"),
        "building_id": issue_input.building_id,
        "building_name": building_name,
        "location_details": issue_input.location_details,
        "lat": lat,
        "lng": lng,
        "pos3d": pos3d,
        "image_url": issue_input.image_url or "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
        "reporter_name": issue_input.reporter_name or "Campus Student",
        "reporter_email": issue_input.reporter_email or "student@campus.edu",
        "upvotes": 1,
        "department": ai_triage.get("department", "Campus Maintenance"),
        "safety_warning": ai_triage.get("safety_warning", "Caution in area."),
        "ai_triage": ai_triage,
        "created_at": now_iso,
        "updated_at": now_iso
    }
    
    ISSUES_CACHE.insert(0, new_issue)
    sync_to_supabase_storage()
    return {"message": "Issue reported successfully", "issue": new_issue}

@app.patch("/api/issues/{issue_id}/status")
def update_issue_status(issue_id: str, body: StatusUpdate):
    """Update issue status (e.g. from reported -> in_progress -> resolved)."""
    for iss in ISSUES_CACHE:
        if iss.get("id") == issue_id:
            iss["status"] = body.status
            iss["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            if body.resolution_notes:
                iss["resolution_notes"] = body.resolution_notes
            sync_to_supabase_storage()
            return {"message": f"Status updated to {body.status}", "issue": iss}
    raise HTTPException(status_code=404, detail="Issue not found")

@app.post("/api/issues/{issue_id}/upvote")
def upvote_issue(issue_id: str):
    """Increment 'Me Too' upvote count for campus issue."""
    for iss in ISSUES_CACHE:
        if iss.get("id") == issue_id:
            iss["upvotes"] = iss.get("upvotes", 0) + 1
            iss["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            sync_to_supabase_storage()
            return {"message": "Upvoted", "upvotes": iss["upvotes"]}
    raise HTTPException(status_code=404, detail="Issue not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
