-- =========================================================================
-- FAMILY OS - SETUP MODULO BAMBINI (KIDS)
-- =========================================================================
-- Questo script crea le 7 tabelle necessarie per gestire l'anagrafica,
-- la salute, lo sviluppo, la logistica e il tempo libero dei bambini.
-- Include anche tutte le policy RLS per isolare i dati per family_id.
-- =========================================================================

-- 1. TABELLA: kids_profiles (Anagrafica e Info Generali)
CREATE TABLE IF NOT EXISTS kids_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT CHECK (gender IN ('Maschio', 'Femmina', 'Altro')),
    birth_place TEXT,
    blood_group TEXT,
    
    -- Emergenze (Contatti Rapidi)
    emergency_contact_1_name TEXT,
    emergency_contact_1_phone TEXT,
    emergency_contact_2_name TEXT,
    emergency_contact_2_phone TEXT,
    
    -- Info Mediche Principali
    pediatrician_name TEXT,
    pediatrician_phone TEXT,
    pediatrician_address TEXT,
    pediatrician_hours TEXT,
    dentist_name TEXT,
    dentist_phone TEXT,
    specialist_name TEXT,
    specialist_phone TEXT,
    
    -- Misure / Taglie base
    shoe_size TEXT,
    clothing_size TEXT,
    
    -- Scadenze Documenti
    id_card_expiry DATE,
    health_card_expiry DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELLA: kids_medical (Vaccini, Allergie, Visite, Malattie Pregresse)
CREATE TABLE IF NOT EXISTS kids_medical (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    kid_id UUID REFERENCES kids_profiles(id) ON DELETE CASCADE,
    
    record_type TEXT NOT NULL CHECK (record_type IN ('vaccine', 'allergy', 'illness', 'visit', 'dental')),
    title TEXT NOT NULL,          -- Es. "Morbillo", "Visita di controllo", "Allergia Nocciole"
    description TEXT,
    date_occurred DATE,           -- Quando è successo o quando è stato fatto il vaccino
    next_due_date DATE,           -- Es. data del richiamo o prossima visita
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELLA: kids_events (Diario eventi acuti, febbre, piccoli traumi)
CREATE TABLE IF NOT EXISTS kids_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    kid_id UUID REFERENCES kids_profiles(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL CHECK (event_type IN ('fever', 'trauma', 'medication', 'other')),
    event_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    temperature DECIMAL(4,1),       -- Es. 38.5
    medication_given TEXT,          -- Es. "Tachipirina"
    description TEXT,               -- Es. "Caduta al parco, sbucciato ginocchio"
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELLA: kids_growth (Registrazione peso, altezza, circonferenza cranica)
CREATE TABLE IF NOT EXISTS kids_growth (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    kid_id UUID REFERENCES kids_profiles(id) ON DELETE CASCADE,
    
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,1),
    head_circumference_cm DECIMAL(5,1),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABELLA: kids_milestones (Diario linguaggio, sviluppo, tappe autonomia)
CREATE TABLE IF NOT EXISTS kids_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    kid_id UUID REFERENCES kids_profiles(id) ON DELETE CASCADE,
    
    category TEXT NOT NULL CHECK (category IN ('language', 'autonomy', 'motor', 'behavior', 'first_times')),
    title TEXT NOT NULL,    -- Es. "Ha detto la prima parola: Papà", "Senza pannolino"
    description TEXT,
    date_achieved DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABELLA: kids_routine (Alimentazione, scuola, zainetto)
-- Questa tabella traccia le abitudini, i menu o i checklist giornalieri
CREATE TABLE IF NOT EXISTS kids_routine (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    kid_id UUID REFERENCES kids_profiles(id) ON DELETE CASCADE,
    
    routine_type TEXT NOT NULL CHECK (routine_type IN ('food', 'school', 'sleep', 'checklist')),
    title TEXT NOT NULL,        -- Es. "Menu Scuola", "Nuovo sapore provato: Broccolo", "Cosa mettere nello zainetto"
    content TEXT,               -- JSON o Testo per la checklist
    rating INT CHECK (rating BETWEEN 1 AND 5), -- Es. per gradimento del cibo
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABELLA: kids_activities (Hobby, Sport, Diario Emozionale genitore/bambino)
CREATE TABLE IF NOT EXISTS kids_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    kid_id UUID REFERENCES kids_profiles(id) ON DELETE CASCADE,
    
    activity_type TEXT NOT NULL CHECK (activity_type IN ('hobby', 'sport', 'parent_diary', 'activity_idea')),
    title TEXT NOT NULL,
    description TEXT,
    schedule TEXT,              -- Es. "Lunedì e Giovedì 17:00-18:00"
    mood TEXT,                  -- Utile per il "Diario emozionale" della giornata
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =========================================================================
-- CONFIGURAZIONE RLS (ROW LEVEL SECURITY)
-- Garantisce che una famiglia veda solo i propri bambini e le proprie memorie
-- =========================================================================

-- Abilitazione RLS per tutte le tabelle
ALTER TABLE kids_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids_medical ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids_growth ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids_routine ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids_activities ENABLE ROW LEVEL SECURITY;

-- Policy per kids_profiles
CREATE POLICY "Kids Profiles Select" ON kids_profiles FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Profiles Insert" ON kids_profiles FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Kids Profiles Update" ON kids_profiles FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Profiles Delete" ON kids_profiles FOR DELETE USING (family_id = public.get_user_family_id());

-- Policy per kids_medical
CREATE POLICY "Kids Medical Select" ON kids_medical FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Medical Insert" ON kids_medical FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Kids Medical Update" ON kids_medical FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Medical Delete" ON kids_medical FOR DELETE USING (family_id = public.get_user_family_id());

-- Policy per kids_events
CREATE POLICY "Kids Events Select" ON kids_events FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Events Insert" ON kids_events FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Kids Events Update" ON kids_events FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Events Delete" ON kids_events FOR DELETE USING (family_id = public.get_user_family_id());

-- Policy per kids_growth
CREATE POLICY "Kids Growth Select" ON kids_growth FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Growth Insert" ON kids_growth FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Kids Growth Update" ON kids_growth FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Growth Delete" ON kids_growth FOR DELETE USING (family_id = public.get_user_family_id());

-- Policy per kids_milestones
CREATE POLICY "Kids Milestones Select" ON kids_milestones FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Milestones Insert" ON kids_milestones FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Kids Milestones Update" ON kids_milestones FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Milestones Delete" ON kids_milestones FOR DELETE USING (family_id = public.get_user_family_id());

-- Policy per kids_routine
CREATE POLICY "Kids Routine Select" ON kids_routine FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Routine Insert" ON kids_routine FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Kids Routine Update" ON kids_routine FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Routine Delete" ON kids_routine FOR DELETE USING (family_id = public.get_user_family_id());

-- Policy per kids_activities
CREATE POLICY "Kids Activities Select" ON kids_activities FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Activities Insert" ON kids_activities FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Kids Activities Update" ON kids_activities FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Kids Activities Delete" ON kids_activities FOR DELETE USING (family_id = public.get_user_family_id());

-- Fine Script
