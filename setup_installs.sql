-- setup_installs.sql
-- Creazione tabella per contare le installazioni PWA anonime
CREATE TABLE IF NOT EXISTS public.app_installs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT
);

-- Abilita RLS
ALTER TABLE public.app_installs ENABLE ROW LEVEL SECURITY;

-- Policy per consentire a chiunque (anche anonimo) di inserire un'installazione
CREATE POLICY "Allow public insert on app_installs"
ON public.app_installs FOR INSERT
WITH CHECK (true);

-- Policy per consentire a tutti di leggere la tabella (per il counter in dashboard)
CREATE POLICY "Allow public read on app_installs"
ON public.app_installs FOR SELECT
USING (true);
