-- Script per aggiornare le chiavi esterne e permettere l'eliminazione dei membri

-- 1. Shopping List (added_by)
ALTER TABLE shopping_list DROP CONSTRAINT IF EXISTS shopping_list_added_by_fkey;
ALTER TABLE shopping_list ADD CONSTRAINT shopping_list_added_by_fkey 
    FOREIGN KEY (added_by) REFERENCES family_members(id) ON DELETE SET NULL;

-- 2. Calendar Events (assigned_to e created_by)
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_assigned_to_fkey;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES family_members(id) ON DELETE SET NULL;

ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_created_by_fkey;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES family_members(id) ON DELETE SET NULL;

-- 3. Family Expenses (paid_by)
-- NOTA: paid_by era NOT NULL. Dobbiamo renderlo nullable per poter usare SET NULL, 
-- oppure usare CASCADE per eliminare le spese (ma perderemmo lo storico). 
-- Meglio SET NULL per mantenere lo storico finanziario.
ALTER TABLE family_expenses ALTER COLUMN paid_by DROP NOT NULL;
ALTER TABLE family_expenses DROP CONSTRAINT IF EXISTS family_expenses_paid_by_fkey;
ALTER TABLE family_expenses ADD CONSTRAINT family_expenses_paid_by_fkey 
    FOREIGN KEY (paid_by) REFERENCES family_members(id) ON DELETE SET NULL;

-- 4. Family Vehicles (owner)
ALTER TABLE family_vehicles DROP CONSTRAINT IF EXISTS family_vehicles_owner_fkey;
ALTER TABLE family_vehicles ADD CONSTRAINT family_vehicles_owner_fkey 
    FOREIGN KEY (owner) REFERENCES family_members(id) ON DELETE SET NULL;
