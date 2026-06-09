-- Esegui questo script in Supabase (SQL Editor) per aggiungere 
-- il supporto agli orari specifici per i promemoria degli animali

ALTER TABLE public.pet_reminders ADD COLUMN due_time TIME;
