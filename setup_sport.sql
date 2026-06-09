-- Script per il Modulo Sport & Benessere

-- 1. Tabella per le attività sportive
CREATE TABLE IF NOT EXISTS public.sport_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
    
    sport_name TEXT NOT NULL,
    activity_date DATE NOT NULL,
    start_time TIME WITHOUT TIME ZONE,
    end_time TIME WITHOUT TIME ZONE,
    location TEXT,
    
    cost NUMERIC(10,2) DEFAULT 0,
    hourly_rate NUMERIC(10,2) DEFAULT 0,
    
    intensity INTEGER CHECK (intensity >= 1 AND intensity <= 10),
    calories INTEGER,
    notes TEXT,
    
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Sicurezza (RLS)
ALTER TABLE public.sport_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sport Select" ON sport_activities;
CREATE POLICY "Sport Select" ON sport_activities FOR SELECT USING (family_id = public.get_user_family_id());

DROP POLICY IF EXISTS "Sport Insert" ON sport_activities;
CREATE POLICY "Sport Insert" ON sport_activities FOR INSERT WITH CHECK (family_id = public.get_user_family_id());

DROP POLICY IF EXISTS "Sport Update" ON sport_activities;
CREATE POLICY "Sport Update" ON sport_activities FOR UPDATE USING (family_id = public.get_user_family_id());

DROP POLICY IF EXISTS "Sport Delete" ON sport_activities;
CREATE POLICY "Sport Delete" ON sport_activities FOR DELETE USING (family_id = public.get_user_family_id());

-- 3. Abilita Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sport_activities;
