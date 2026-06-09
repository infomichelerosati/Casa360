-- Esegui questo script nel tab "SQL Editor" del tuo progetto Supabase

-- 1. Tabella dei Membri della Famiglia
CREATE TABLE family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'member', -- Può essere 'admin', 'member', o 'child'
  avatar_color TEXT,          -- Es. '#3b82f6' per dare un colore distintivo a ognuno
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabella della Lista della Spesa
CREATE TABLE shopping_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  category TEXT DEFAULT 'Generico', -- Es. 'Alimentari', 'Casa', ecc.
  is_urgent BOOLEAN DEFAULT false,
  is_bought BOOLEAN DEFAULT false,
  added_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Abilita Realtime per la tabella shopping_list (fondamentale per sincronizzare i dispositivi)
alter publication supabase_realtime add table shopping_list;

-- Inseriamo un membro fittizio iniziale per testare l'app
INSERT INTO family_members (name, role, avatar_color) 
VALUES ('Papà', 'admin', '#3b82f6'), ('Mamma', 'admin', '#ef4444');

-- -------------------------------------------------------------
-- 3. Tabella degli Eventi e Calendario
-- -------------------------------------------------------------
CREATE TABLE calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  assigned_to UUID REFERENCES family_members(id) ON DELETE SET NULL, -- Chi deve fare la cosa (opzionale se è di tutti)
  created_by UUID REFERENCES family_members(id) ON DELETE SET NULL, -- Chi l'ha inserito
  location TEXT,
  event_type TEXT DEFAULT 'Appuntamenti', -- Es. 'Studio', 'Lavoro', 'Visite Mediche', 'Compleanni'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Abilita Realtime per la tabella calendar_events per notifiche e aggiornamenti simultanei
alter publication supabase_realtime add table calendar_events;

-- -------------------------------------------------------------
-- 4. Tabella Finanze e Spese Comuni (Family Wallet)
-- -------------------------------------------------------------
CREATE TABLE family_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  paid_by UUID REFERENCES family_members(id) ON DELETE SET NULL, -- Chi ha anticipato i soldi
  category TEXT DEFAULT 'Spesa Condivisa', -- Es. 'Bollette', 'Spesa', 'Casa', 'Svago'
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Abilita Realtime
alter publication supabase_realtime add table family_expenses;

-- -------------------------------------------------------------
-- 5. Tabella Veicoli e Scadenze (Family Garage)
-- -------------------------------------------------------------
CREATE TABLE family_vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- Es. 'Panda Mamma', 'BMW Papà'
  plate TEXT, -- Targa opzionale
  vehicle_type TEXT DEFAULT 'Auto', -- 'Auto', 'Moto', 'Scooter'
  is_gpl BOOLEAN DEFAULT false, -- Indica se il veicolo ha impianto GPL
  insurance_expiry DATE NOT NULL,
  tax_expiry DATE NOT NULL, -- Bollo
  inspection_expiry DATE NOT NULL, -- Revisione
  gpl_expiry DATE, -- Scadenza bombola GPL (solo se is_gpl = true)
  owner UUID REFERENCES family_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Abilita Realtime
alter publication supabase_realtime add table family_vehicles;
