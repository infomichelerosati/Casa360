-- =========================================================================================================
-- MODULE: ANIMALI (PETS)
-- ATTENZIONE: Questo script crea le tabelle per il modulo Animali e le policy RLS.
-- =========================================================================================================

-- 1. PETS (Anagrafica)
CREATE TABLE public.family_pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    species TEXT NOT NULL CHECK (species IN ('Cane', 'Gatto', 'Uccello', 'Roditore', 'Rettile', 'Pesce', 'Altro')),
    breed TEXT,
    birth_date DATE,
    microchip TEXT,
    passport TEXT,
    gender TEXT CHECK (gender IN ('M', 'F', 'Sconosciuto')),
    weight NUMERIC(5,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.family_pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pets Select" ON public.family_pets FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Pets Insert" ON public.family_pets FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Pets Update" ON public.family_pets FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Pets Delete" ON public.family_pets FOR DELETE USING (family_id = public.get_user_family_id());

-- 2. STORICO MEDICO (Visite, Interventi)
CREATE TABLE public.pet_medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    pet_id UUID REFERENCES public.family_pets(id) ON DELETE CASCADE NOT NULL,
    record_date DATE NOT NULL,
    record_type TEXT NOT NULL CHECK (record_type IN ('Visita', 'Intervento', 'Esame', 'Malattia', 'Altro')),
    title TEXT NOT NULL,
    description TEXT,
    veterinarian TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.pet_medical_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pet Medical Select" ON public.pet_medical_records FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Pet Medical Insert" ON public.pet_medical_records FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Pet Medical Update" ON public.pet_medical_records FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Pet Medical Delete" ON public.pet_medical_records FOR DELETE USING (family_id = public.get_user_family_id());

-- 3. PROMEMORIA/SCADENZE (Vaccini, Antiparassitario)
CREATE TABLE public.pet_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    pet_id UUID REFERENCES public.family_pets(id) ON DELETE CASCADE NOT NULL,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('Vaccino', 'Antiparassitario', 'Sverminazione', 'Visita Controllo', 'Altro')),
    title TEXT NOT NULL,
    due_date DATE NOT NULL,
    due_time TIME,
    is_completed BOOLEAN DEFAULT false,
    completed_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.pet_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pet Reminders Select" ON public.pet_reminders FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Pet Reminders Insert" ON public.pet_reminders FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Pet Reminders Update" ON public.pet_reminders FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Pet Reminders Delete" ON public.pet_reminders FOR DELETE USING (family_id = public.get_user_family_id());
