-- =========================================================================
-- CampusFixer: Supabase PostgreSQL Schema & Security Policies
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Campus Buildings & Zones
CREATE TABLE IF NOT EXISTS public.campus_buildings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    pos_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_z DOUBLE PRECISION NOT NULL DEFAULT 0,
    floors INTEGER DEFAULT 1,
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Reported Issues
CREATE TABLE IF NOT EXISTS public.issues (
    id TEXT PRIMARY KEY DEFAULT ('iss-' || substr(md5(random()::text), 1, 8)),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('plumbing', 'electrical', 'structural', 'hvac', 'hazard', 'furniture', 'it_network', 'other')),
    status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'in_progress', 'resolved')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    building_id TEXT REFERENCES public.campus_buildings(id) ON DELETE SET NULL,
    building_name TEXT NOT NULL,
    location_details TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    pos_x DOUBLE PRECISION,
    pos_y DOUBLE PRECISION,
    pos_z DOUBLE PRECISION,
    image_url TEXT,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reporter_name TEXT DEFAULT 'Campus Student',
    reporter_email TEXT,
    upvotes INTEGER DEFAULT 1,
    department TEXT DEFAULT 'Facilities Management',
    safety_warning TEXT,
    ai_triage JSONB,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Issue Upvotes ("Me Too" confirmations)
CREATE TABLE IF NOT EXISTS public.issue_upvotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id TEXT NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(issue_id, user_id),
    UNIQUE(issue_id, session_id)
);

-- 4. Issue Activity & Resolution Log
CREATE TABLE IF NOT EXISTS public.issue_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id TEXT NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_building ON public.issues(building_id);
CREATE INDEX IF NOT EXISTS idx_issues_category ON public.issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON public.issues(severity);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON public.issues(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE public.campus_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_activity ENABLE ROW LEVEL SECURITY;

-- Public read access so students can view all reported campus issues
CREATE POLICY "Allow public read buildings" ON public.campus_buildings FOR SELECT USING (true);
CREATE POLICY "Allow public read issues" ON public.issues FOR SELECT USING (true);
CREATE POLICY "Allow public insert issues" ON public.issues FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update issues" ON public.issues FOR UPDATE USING (true);
CREATE POLICY "Allow public read upvotes" ON public.issue_upvotes FOR SELECT USING (true);
CREATE POLICY "Allow insert upvotes" ON public.issue_upvotes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read activity" ON public.issue_activity FOR SELECT USING (true);
