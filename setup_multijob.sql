-- setup_multijob.sql
-- Esegui questo script in Supabase (SQL Editor) per aggiungere 
-- il supporto al nuovo Modulo Multi JOB (Lavori multipli, sovrapposizioni)

CREATE TABLE public.mj_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    hourly_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.mj_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES public.mj_jobs(id) ON DELETE CASCADE NOT NULL,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indici per ottimizzare
CREATE INDEX idx_mj_jobs_family ON public.mj_jobs(family_id);
CREATE INDEX idx_mj_shifts_date ON public.mj_shifts(family_id, shift_date);
CREATE INDEX idx_mj_shifts_job ON public.mj_shifts(job_id);

-- RLS Policies mj_jobs
ALTER TABLE public.mj_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MJ Jobs Select" ON public.mj_jobs FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "MJ Jobs Insert" ON public.mj_jobs FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "MJ Jobs Update" ON public.mj_jobs FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "MJ Jobs Delete" ON public.mj_jobs FOR DELETE USING (family_id = public.get_user_family_id());

-- RLS Policies mj_shifts
ALTER TABLE public.mj_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MJ Shifts Select" ON public.mj_shifts FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "MJ Shifts Insert" ON public.mj_shifts FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "MJ Shifts Update" ON public.mj_shifts FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "MJ Shifts Delete" ON public.mj_shifts FOR DELETE USING (family_id = public.get_user_family_id());
