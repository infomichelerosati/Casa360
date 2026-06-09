-- setup_lavoro.sql
-- Esegui questo script in Supabase (SQL Editor) per aggiungere 
-- il supporto al Modulo Lavoro (Turni, Riposi, Ferie)

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

-- RLS Policies
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Work Shifts Select" ON public.work_shifts FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Work Shifts Insert" ON public.work_shifts FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Work Shifts Update" ON public.work_shifts FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Work Shifts Delete" ON public.work_shifts FOR DELETE USING (family_id = public.get_user_family_id());
