-- ─────────────────────────────────────────────────────────────
-- AVI — Información de interés (Análisis Clínicos)
-- Pegar en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.patient_expediente
  ADD COLUMN IF NOT EXISTS ac_informacion_interes TEXT;
