# LostMate AI

AI-powered Lost & Found Smart Matching for campuses, events, and venues.

## Tech Stack
- Frontend: React + Vite + Tailwind + TypeScript
- Backend: Python FastAPI (Vercel Serverless)
- Database: Supabase (Auth, Postgres + pgvector, Storage)
- AI: Google Gemini

## Setup

### Environment Variables
Copy `.env.example` to `.env` and fill in your keys.

### Run Locally
```bash
# Frontend
cd web
npm install
npm run dev

# Backend
cd api
pip install -r requirements.txt
uvicorn index:app --reload
```
