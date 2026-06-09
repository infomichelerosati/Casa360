-- =========================================================================================================
-- MODULE: SINTONIA (Benessere Personale e Relazionale)
-- =========================================================================================================

CREATE TABLE public.sintonia_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE NOT NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Stato interno dell'utente in quel giorno (es: 'Energico', 'Stanco', 'Calmo', 'Sotto pressione', 'Allegro', 'Triste', 'Arrabbiato')
    internal_state TEXT,
    
    -- Un oggetto JSON per salvare come questo utente si relaziona agli altri oggi
    -- Formato es: { "uuid-membro-1": "heart", "uuid-membro-2": "lightning", "uuid-membro-3": "neutral" }
    relational_states JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Un utente può avere un solo log al giorno (che verrà aggiornato se cambia idea)
    UNIQUE(family_id, member_id, log_date)
);

-- Indici per ottimizzare le query
CREATE INDEX idx_sintonia_logs_date ON public.sintonia_logs(family_id, log_date);
CREATE INDEX idx_sintonia_logs_member ON public.sintonia_logs(member_id, log_date);

-- Abilita RLS
ALTER TABLE public.sintonia_logs ENABLE ROW LEVEL SECURITY;

-- Regole RLS (Solo la propria famiglia può vedere/inserire/modificare)
CREATE POLICY "Sintonia Logs Select" ON public.sintonia_logs FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Sintonia Logs Insert" ON public.sintonia_logs FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Sintonia Logs Update" ON public.sintonia_logs FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Sintonia Logs Delete" ON public.sintonia_logs FOR DELETE USING (family_id = public.get_user_family_id());

-- Aggiungi trigger per updated_at (opzionale, ma utile per l'upsert)
CREATE OR REPLACE FUNCTION update_sintonia_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sintonia_modtime
BEFORE UPDATE ON public.sintonia_logs
FOR EACH ROW EXECUTE PROCEDURE update_sintonia_updated_at_column();
