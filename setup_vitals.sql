-- Script per i Parametri Vitali (Salute)

-- 1. Aggiunta colonna intervallo promemoria al profilo salute
ALTER TABLE public.health_profiles 
ADD COLUMN IF NOT EXISTS vitals_reminder_interval INTEGER DEFAULT 0;

-- 2. Tabella per i log dei parametri vitali
CREATE TABLE IF NOT EXISTS public.health_vitals_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
    
    systolic_pressure INTEGER, -- Pressione Massima
    diastolic_pressure INTEGER, -- Pressione Minima
    heart_rate INTEGER,        -- Battiti cardiaci (BPM)
    oxygen_saturation INTEGER, -- Saturazione Ossigeno (%)
    blood_sugar NUMERIC(5,2),  -- Indice glicemico (mg/dL)
    weight NUMERIC(5,2),       -- Peso (kg)
    temperature NUMERIC(4,1),  -- Temperatura (°C)
    notes TEXT,                -- Note aggiuntive
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Sicurezza (RLS)
ALTER TABLE public.health_vitals_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vitals Select" ON health_vitals_logs;
CREATE POLICY "Vitals Select" ON health_vitals_logs FOR SELECT USING (family_id = public.get_user_family_id());

DROP POLICY IF EXISTS "Vitals Insert" ON health_vitals_logs;
CREATE POLICY "Vitals Insert" ON health_vitals_logs FOR INSERT WITH CHECK (family_id = public.get_user_family_id());

DROP POLICY IF EXISTS "Vitals Update" ON health_vitals_logs;
CREATE POLICY "Vitals Update" ON health_vitals_logs FOR UPDATE USING (family_id = public.get_user_family_id());

DROP POLICY IF EXISTS "Vitals Delete" ON health_vitals_logs;
CREATE POLICY "Vitals Delete" ON health_vitals_logs FOR DELETE USING (family_id = public.get_user_family_id());

-- 4. Realtime
-- alter publication supabase_realtime add table health_vitals_logs;
