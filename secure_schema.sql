-- ATTENZIONE: Questo script eliminerà tutte le tabelle (e i dati) legati a Family OS!
-- Serve per azzerare il database e ricostruirlo con la sicurezza "Multi-Famiglia" attiva.

-- Elimina tutte le tabelle vecchie
DROP TABLE IF EXISTS shopping_list CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS family_expenses CASCADE;
DROP TABLE IF EXISTS family_vehicles CASCADE;
DROP TABLE IF EXISTS family_members CASCADE;
DROP TABLE IF EXISTS family_groups CASCADE;

-- 1. Tabella dei Gruppi Famiglia
CREATE TABLE family_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL, -- Codice univoco di 6 lettere/numeri per far entrare gli altri
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE family_groups ENABLE ROW LEVEL SECURITY;

-- 2. Tabella dei Membri della Famiglia
CREATE TABLE family_members (
  id UUID PRIMARY KEY, -- Coinciderà con auth.uid() se è un utente vero
  family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'member', 
  avatar_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- 3. Lista della Spesa
CREATE TABLE shopping_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT DEFAULT 'Generico',
  is_urgent BOOLEAN DEFAULT false,
  is_bought BOOLEAN DEFAULT false,
  added_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;
alter publication supabase_realtime add table shopping_list;

-- 4. Calendario
CREATE TABLE calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  assigned_to UUID REFERENCES family_members(id) ON DELETE SET NULL,
  created_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  location TEXT,
  event_type TEXT DEFAULT 'Appuntamenti',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
alter publication supabase_realtime add table calendar_events;

-- 5. Finanze
CREATE TABLE family_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  paid_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  category TEXT DEFAULT 'Spesa Condivisa',
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE family_expenses ENABLE ROW LEVEL SECURITY;
alter publication supabase_realtime add table family_expenses;

-- 6. Veicoli
CREATE TABLE family_vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  plate TEXT,
  vehicle_type TEXT DEFAULT 'Auto',
  is_gpl BOOLEAN DEFAULT false,
  insurance_expiry DATE NOT NULL,
  tax_expiry DATE NOT NULL,
  inspection_expiry DATE NOT NULL,
  gpl_expiry DATE,
  owner UUID REFERENCES family_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE family_vehicles ENABLE ROW LEVEL SECURITY;
alter publication supabase_realtime add table family_vehicles;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - Il cuore della sicurezza
-- ==============================================================================

-- Funzione di supporto per ottenere la famiglia dell'utente loggato
CREATE OR REPLACE FUNCTION public.get_user_family_id() RETURNS UUID AS $$
  SELECT family_id FROM public.family_members WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Funzione RPC per permettere a un app in fase di Login/Registrazione di verificare 
-- un join_code bypassando le policy RLS attive sulla tabella family_groups.
CREATE OR REPLACE FUNCTION public.check_join_code(code_to_check text) RETURNS UUID AS $$
DECLARE
  found_id UUID;
BEGIN
  SELECT id INTO found_id FROM public.family_groups WHERE join_code = code_to_check LIMIT 1;
  RETURN found_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione di supporto per ottenere il ruolo (admin, member, etc) dell'utente loggato
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS TEXT AS $$
  SELECT role FROM public.family_members WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- REGOLE PER FAMILY_GROUPS
-- Un utente può vedere il proprio gruppo famiglia
CREATE POLICY "Users can view their own family group" ON family_groups
  FOR SELECT USING (id = public.get_user_family_id());
  
-- Chiunque (anche chi si sta appena registrando) può inserire un nuovo gruppo famiglia (creazione)
CREATE POLICY "Anyone can create a family group" ON family_groups
  FOR INSERT WITH CHECK (true);

-- REGOLE PER FAMILY_MEMBERS
-- Un utente può vedere solo i membri che fanno parte della sua stessa famiglia
CREATE POLICY "Users can view family members in their family" ON family_members
  FOR SELECT USING (family_id = public.get_user_family_id());

-- Un utente può creare un membro solo nella propria famiglia. 
-- Eccezione: l'utente appena iscritto che sta creando il suo stesso profilo (può scegliere family_id).
CREATE POLICY "Users can insert members" ON family_members
  FOR INSERT WITH CHECK (
    auth.uid() = id OR 
    family_id = public.get_user_family_id()
  );

-- Un utente può aggiornare o eliminare solo membri della propria famiglia
-- PROTEZIONE RBAC: Un utente non-admin non può aggiornare o eliminare un admin.
CREATE POLICY "Users can update their family members" ON family_members
  FOR UPDATE USING (
      family_id = public.get_user_family_id() AND
      (role != 'admin' OR public.get_user_role() = 'admin' OR id = auth.uid())
  );
  
CREATE POLICY "Users can delete their family members" ON family_members
  FOR DELETE USING (
      family_id = public.get_user_family_id() AND
      (role != 'admin' OR public.get_user_role() = 'admin' OR id = auth.uid())
  );

-- REGOLE GENERICHE PER LISTE, CALENDARIO, FINANZE, E VEICOLI
-- Lettura: solo righe con il proprio family_id
-- Inserimento: solo se si inserisce righe con il proprio family_id
-- Modifica/Cancellazione: solo righe della propria famiglia

-- Shopping List
CREATE POLICY "Spesa Select" ON shopping_list FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Spesa Insert" ON shopping_list FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Spesa Update" ON shopping_list FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Spesa Delete" ON shopping_list FOR DELETE USING (family_id = public.get_user_family_id());

-- Calendar
CREATE POLICY "Calendar Select" ON calendar_events FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Calendar Insert" ON calendar_events FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Calendar Update" ON calendar_events FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Calendar Delete" ON calendar_events FOR DELETE USING (family_id = public.get_user_family_id());

-- Finances
CREATE POLICY "Finances Select" ON family_expenses FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Finances Insert" ON family_expenses FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Finances Update" ON family_expenses FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Finances Delete" ON family_expenses FOR DELETE USING (family_id = public.get_user_family_id());

-- Vehicles
CREATE POLICY "Vehicles Select" ON family_vehicles FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Vehicles Insert" ON family_vehicles FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Vehicles Update" ON family_vehicles FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Vehicles Delete" ON family_vehicles FOR DELETE USING (family_id = public.get_user_family_id());

-- =========================================================================================================
-- MODULE: SALUTE (HEALTH)
-- =========================================================================================================

-- 1. PROFILI SALUTE (1-to-1 con family_members)
CREATE TABLE public.health_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE UNIQUE,
    blood_type TEXT CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-', 'Desconosciuto')),
    allergies TEXT[] DEFAULT '{}',
    chronic_conditions TEXT[] DEFAULT '{}',
    primary_doctor TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Health Profiles Select" ON health_profiles FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Health Profiles Insert" ON health_profiles FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Health Profiles Update" ON health_profiles FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Health Profiles Delete" ON health_profiles FOR DELETE USING (family_id = public.get_user_family_id());

-- 2. FARMACI E ARMADIETTO
CREATE TABLE public.health_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    stock_remaining INTEGER DEFAULT 0,
    expiry_date DATE,
    assigned_to UUID REFERENCES public.family_members(id) ON DELETE SET NULL, -- Se null = farmaco generico per tutti
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.health_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Health Meds Select" ON health_medications FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Health Meds Insert" ON health_medications FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Health Meds Update" ON health_medications FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Health Meds Delete" ON health_medications FOR DELETE USING (family_id = public.get_user_family_id());

-- 3. STORICO EVENTI MEDICI (Visite, Vaccini, Esami)
CREATE TABLE public.health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    record_type TEXT NOT NULL CHECK (record_type IN ('Visita', 'Vaccino', 'Esame', 'Intervento', 'Malattia', 'Altro')),
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Health Records Select" ON health_records FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Health Records Insert" ON health_records FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Health Records Update" ON health_records FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Health Records Delete" ON health_records FOR DELETE USING (family_id = public.get_user_family_id());

-- 4. REGISTRO GIORNALIERO FARMACI (Per la Dashboard)
CREATE TABLE public.health_medication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    medication_id UUID REFERENCES public.health_medications(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
    date_taken DATE NOT NULL DEFAULT CURRENT_DATE,
    time_taken TIME NOT NULL DEFAULT CURRENT_TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.health_medication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Health Logs Select" ON health_medication_logs FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Health Logs Insert" ON health_medication_logs FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Health Logs Delete" ON health_medication_logs FOR DELETE USING (family_id = public.get_user_family_id());

-- =========================================================================================================
-- MODULE: ANIMALI (PETS)
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
-- 4. Modulo Lavoro (Turni, Riposi, Ferie)
CREATE TABLE public.work_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE NOT NULL,
    shift_date DATE NOT NULL,
    shift_type TEXT NOT NULL CHECK (shift_type IN ('Lavoro', 'Riposo', 'Ferie', 'Malattia', 'Permesso', 'Reperibilità', 'Altro')),
    start_time TIME,
    end_time TIME,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indice per ottimizzare la vista settimanale
CREATE INDEX idx_work_shifts_date ON public.work_shifts(family_id, shift_date);

ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Work Shifts Select" ON public.work_shifts FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Work Shifts Insert" ON public.work_shifts FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Work Shifts Update" ON public.work_shifts FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Work Shifts Delete" ON public.work_shifts FOR DELETE USING (family_id = public.get_user_family_id());

-- 5. Modulo Documenti (Integrazione Storage)
CREATE TABLE public.family_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    uploaded_by UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('Identità', 'Salute', 'Casa', 'Veicoli', 'Scuola', 'Altro')),
    expiry_date DATE,
    file_url TEXT NOT NULL, 
    file_type TEXT NOT NULL, 
    file_size INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_family_documents_family ON public.family_documents(family_id);
CREATE INDEX idx_family_documents_expiry ON public.family_documents(family_id, expiry_date);

ALTER TABLE public.family_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doc Select" ON public.family_documents FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Doc Insert" ON public.family_documents FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Doc Update" ON public.family_documents FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Doc Delete" ON public.family_documents FOR DELETE USING (family_id = public.get_user_family_id());
