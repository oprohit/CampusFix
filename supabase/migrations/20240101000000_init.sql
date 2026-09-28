-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
CREATE TYPE user_role AS ENUM ('user', 'staff');
CREATE TYPE report_status AS ENUM ('open', 'matched', 'claimed', 'closed');
CREATE TYPE match_status AS ENUM ('suggested', 'notified', 'claim_requested', 'verified', 'rejected');
CREATE TYPE message_type AS ENUM ('text', 'image', 'match_cards', 'system');
CREATE TYPE message_role AS ENUM ('user', 'bot', 'staff');

-- 1. Profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role user_role DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Lost Reports
CREATE TABLE lost_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    colors TEXT[],
    brand TEXT,
    description TEXT,
    attributes JSONB,
    image_path TEXT,
    embedding VECTOR(768),
    location_text TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    lost_at TIMESTAMPTZ,
    status report_status DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Found Reports
CREATE TABLE found_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finder_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    colors TEXT[],
    brand TEXT,
    description TEXT,
    attributes JSONB,
    image_path TEXT,
    embedding VECTOR(768),
    location_text TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    found_at TIMESTAMPTZ,
    holding_location TEXT,
    status report_status DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Matches
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lost_id UUID REFERENCES lost_reports(id) ON DELETE CASCADE,
    found_id UUID REFERENCES found_reports(id) ON DELETE CASCADE,
    score FLOAT NOT NULL,
    breakdown JSONB,
    explanation TEXT,
    status match_status DEFAULT 'suggested',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lost_id, found_id)
);

-- 5. Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    lost_report_id UUID REFERENCES lost_reports(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role message_role NOT NULL,
    type message_type NOT NULL,
    content TEXT,
    image_path TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE found_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile, staff can read all
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Staff can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'staff')
);

-- Lost Reports: Owners can read/write, staff can read all
CREATE POLICY "Owners can manage lost reports" ON lost_reports FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Staff can view all lost reports" ON lost_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'staff')
);

-- Found Reports: Finders can manage their own, staff can manage all. Everyone can select (used by matching logic)
CREATE POLICY "Finders can manage own found reports" ON found_reports FOR ALL USING (auth.uid() = finder_id);
CREATE POLICY "Staff can manage all found reports" ON found_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'staff')
);
-- Note: the actual matching runs server-side with service_role, so normal users don't need SELECT on all found items.

-- Matches: Owners of the lost report can see their matches. Staff can see all.
CREATE POLICY "Users can view own matches" ON matches FOR SELECT USING (
  EXISTS (SELECT 1 FROM lost_reports lr WHERE lr.id = matches.lost_id AND lr.owner_id = auth.uid())
);
CREATE POLICY "Users can update own matches" ON matches FOR UPDATE USING (
  EXISTS (SELECT 1 FROM lost_reports lr WHERE lr.id = matches.lost_id AND lr.owner_id = auth.uid())
);
CREATE POLICY "Staff can manage all matches" ON matches FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'staff')
);

-- Conversations and Messages: Users can see their own, staff can see all
CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Staff can view all conversations" ON conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'staff')
);

CREATE POLICY "Users can manage own messages" ON messages FOR ALL USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Staff can view all messages" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'staff')
);

-- Notifications: Users can see/update their own
CREATE POLICY "Users can manage own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- RPC for pgvector similarity search
CREATE OR REPLACE FUNCTION match_found_reports(
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT,
  time_limit TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  category TEXT,
  colors TEXT[],
  brand TEXT,
  description TEXT,
  attributes JSONB,
  image_path TEXT,
  location_text TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  found_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fr.id,
    fr.title,
    fr.category,
    fr.colors,
    fr.brand,
    fr.description,
    fr.attributes,
    fr.image_path,
    fr.location_text,
    fr.lat,
    fr.lng,
    fr.found_at,
    1 - (fr.embedding <=> query_embedding) AS similarity
  FROM found_reports fr
  WHERE fr.status = 'open' 
    AND (time_limit IS NULL OR fr.found_at >= time_limit)
    AND 1 - (fr.embedding <=> query_embedding) > match_threshold
  ORDER BY fr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
