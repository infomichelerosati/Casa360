-- ============================================================================
-- SCRIPT DI CORREZIONE: STORAGE RLS POLICIES PER I DOCUMENTI
-- ============================================================================
-- Esegui questo script nel SQL Editor di Supabase. 
-- Corregge il problema "new row violates row-level security policy" (errore 400)
-- durante l'upload dei file nel bucket 'documents'.

-- 1. Elimina le vecchie policy che non funzionavano correttamente
DROP POLICY IF EXISTS "Storage Doc Select" ON storage.objects;
DROP POLICY IF EXISTS "Storage Doc Insert" ON storage.objects;
DROP POLICY IF EXISTS "Storage Doc Delete" ON storage.objects;
DROP POLICY IF EXISTS "Storage Doc Update" ON storage.objects;

-- 2. Ricrea le Policy in modo più robusto
-- Usa la funzione 'get_user_family_id()' che già esiste e funziona per le tabelle

-- Lettura: l'utente può scaricare un file solo se la cartella di base (il primo segmento del percorso) 
-- corrisponde all'ID della sua famiglia.
CREATE POLICY "Storage Doc Select" ON storage.objects FOR SELECT 
USING (
  bucket_id = 'documents' AND 
  (auth.uid() IS NOT NULL) AND
  ((string_to_array(name, '/'))[1] = public.get_user_family_id()::text)
);

-- Inserimento: l'utente può caricare un file solo dentro una cartella che ha l'ID della sua famiglia.
-- Nello storage di Supabase moderno, spesso l'insert richiede il controllo su inserimento (WITH CHECK).
CREATE POLICY "Storage Doc Insert" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' AND 
  (auth.uid() IS NOT NULL) AND
  ((string_to_array(name, '/'))[1] = public.get_user_family_id()::text)
);

-- Eliminazione: l'utente può cancellare un file solo dalla cartella della sua famiglia.
CREATE POLICY "Storage Doc Delete" ON storage.objects FOR DELETE 
USING (
  bucket_id = 'documents' AND 
  (auth.uid() IS NOT NULL) AND
  ((string_to_array(name, '/'))[1] = public.get_user_family_id()::text)
);

-- Aggiornamento (sostituzione file esistente):
CREATE POLICY "Storage Doc Update" ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'documents' AND 
  (auth.uid() IS NOT NULL) AND
  ((string_to_array(name, '/'))[1] = public.get_user_family_id()::text)
);
