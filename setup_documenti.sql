-- setup_documenti.sql
-- Esegui questo script in Supabase (SQL Editor) per aggiungere 
-- il supporto al Modulo Documenti e configurare lo Storage.

-- 1. CREAZIONE TABELLA METADATI
CREATE TABLE public.family_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    uploaded_by UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('Identità', 'Salute', 'Casa', 'Veicoli', 'Scuola', 'Altro')),
    expiry_date DATE,
    file_url TEXT NOT NULL, -- Percorso sullo storage: family_id/filename
    file_type TEXT NOT NULL, 
    file_size INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indici per performance
CREATE INDEX idx_family_documents_family ON public.family_documents(family_id);
CREATE INDEX idx_family_documents_expiry ON public.family_documents(family_id, expiry_date);

-- RLS Tabella Documenti
ALTER TABLE public.family_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doc Select" ON public.family_documents FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Doc Insert" ON public.family_documents FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Doc Update" ON public.family_documents FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Doc Delete" ON public.family_documents FOR DELETE USING (family_id = public.get_user_family_id());

-- 2. CONFIGURAZIONE STORAGE BUCKET
-- Creiamo il bucket "documents" se non esiste (richiede privilegi admin in Supabase, 
-- in genere la dashboard SQL li ha).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- RLS Bucket Storage 'documents'
-- ATTENZIONE: Le policy per storage usano "storage.objects", controllando il bucket_id 
-- e ricavando family_id dalla path del file (che struttureremo come: family_id/filename.jpg)

-- Permette agli utenti di leggere solo i file che iniziano con il loro family_id
CREATE POLICY "Storage Doc Select" ON storage.objects FOR SELECT 
USING ( bucket_id = 'documents' AND (auth.uid() IN (SELECT id FROM public.family_members WHERE family_id::text = (string_to_array(name, '/'))[1])) );

-- Permette agli utenti di inserire file solo in una cartella che ha il nome del loro family_id
CREATE POLICY "Storage Doc Insert" ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'documents' AND (auth.uid() IN (SELECT id FROM public.family_members WHERE family_id::text = (string_to_array(name, '/'))[1])) );

-- Permette agli utenti di cancellare file solo dalla cartella della loro famiglia
CREATE POLICY "Storage Doc Delete" ON storage.objects FOR DELETE 
USING ( bucket_id = 'documents' AND (auth.uid() IN (SELECT id FROM public.family_members WHERE family_id::text = (string_to_array(name, '/'))[1])) );
