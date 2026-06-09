-- setup_pasti.sql
-- Esegui questo script nel tab "SQL Editor" di Supabase per creare le tabelle del modulo Pasti & Dispensa.

-- =========================================================================================================
-- MODULE: PASTI E DISPENSA (MEAL PLANNER)
-- =========================================================================================================

-- 1. RICETTARIO FAMIGLIA (I piatti preferiti salvati)
CREATE TABLE public.family_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    emoji TEXT DEFAULT '🍽️', -- Un'icona visuale per la dashboard
    prep_time_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.family_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipes Select" ON public.family_recipes FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Recipes Insert" ON public.family_recipes FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Recipes Update" ON public.family_recipes FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Recipes Delete" ON public.family_recipes FOR DELETE USING (family_id = public.get_user_family_id());

-- Abilitiamo il realtime per le ricette
alter publication supabase_realtime add table public.family_recipes;


-- 2. INGREDIENTI DELLE RICETTE
CREATE TABLE public.recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    recipe_id UUID REFERENCES public.family_recipes(id) ON DELETE CASCADE NOT NULL,
    ingredient_name TEXT NOT NULL,
    quantity TEXT, -- Es. '200g', '2 cucchiai', '1 misurino' ecc. Opzionale.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipe Ingredients Select" ON public.recipe_ingredients FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Recipe Ingredients Insert" ON public.recipe_ingredients FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Recipe Ingredients Update" ON public.recipe_ingredients FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Recipe Ingredients Delete" ON public.recipe_ingredients FOR DELETE USING (family_id = public.get_user_family_id());

-- Abilitiamo il realtime
alter publication supabase_realtime add table public.recipe_ingredients;


-- 3. PIANO PASTI SETTIMANALE (Il calendario)
CREATE TABLE public.meal_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    recipe_id UUID REFERENCES public.family_recipes(id) ON DELETE SET NULL, -- Se NULL potremmo star scrivendo testo libero
    custom_meal_name TEXT, -- Usato se non si seleziona una ricetta ma si scrive "Pranzo dai nonni" o "Avanzi"
    planned_date DATE NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('Pranzo', 'Cena')),
    created_by UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indice per calcolare velocemente i pasti di una determinata settimana
CREATE INDEX idx_meal_plan_week ON public.meal_plan(family_id, planned_date);

ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Meal Plan Select" ON public.meal_plan FOR SELECT USING (family_id = public.get_user_family_id());
CREATE POLICY "Meal Plan Insert" ON public.meal_plan FOR INSERT WITH CHECK (family_id = public.get_user_family_id());
CREATE POLICY "Meal Plan Update" ON public.meal_plan FOR UPDATE USING (family_id = public.get_user_family_id());
CREATE POLICY "Meal Plan Delete" ON public.meal_plan FOR DELETE USING (family_id = public.get_user_family_id());

-- Abilitiamo il realtime
alter publication supabase_realtime add table public.meal_plan;
