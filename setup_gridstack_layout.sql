-- setup_gridstack_layout.sql
-- Esegui questo script in Supabase SQL Editor per supportare i layout personalizzati della Dashboard

-- Aggiunge la colonna JSONB alla tabella family_members (se non esiste già)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='family_members' AND column_name='dashboard_layout'
    ) THEN
        ALTER TABLE public.family_members ADD COLUMN dashboard_layout JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;
