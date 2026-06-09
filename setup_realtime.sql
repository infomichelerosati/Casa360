-- setup_realtime.sql
-- Script per abilitare Supabase Realtime sulle tabelle chiave

-- 1. Per prima cosa, è fondamentale impostare l'identità di replica su FULL
-- così i vari payload (INSERT, UPDATE) conterranno tutti i dati di riga.
ALTER TABLE public.shopping_list REPLICA IDENTITY FULL;
ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;

-- 2. Aggiunge le tabelle alla "publication" speciale per Realtime
-- NOTA: Su Supabase, la publication 'supabase_realtime' esiste già di default.
-- Dobbiamo solo dirgli a quali tabelle iscriversi.

BEGIN;
  -- Verifica se la publication esiste, ed esegui le ALTER. 
  -- InSupabase via UI è più semplice: Database -> Replication -> Toggle tabelle.
  -- Via SQL si esegue così:
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'shopping_list') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_list;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'calendar_events') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
    END IF;
  END
  $$;
COMMIT;
