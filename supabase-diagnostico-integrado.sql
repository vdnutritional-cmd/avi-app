-- ─────────────────────────────────────────────────────────────
-- AVI — Diagnóstico Integrado: columna en patient_expediente
-- Pegar en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.patient_expediente
  ADD COLUMN IF NOT EXISTS ac_diagnostico_integrado TEXT;
