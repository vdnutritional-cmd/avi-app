-- ─────────────────────────────────────────────────────────────
-- AVI — Información del proceso psicológico
-- Pegar en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.patient_expediente
  ADD COLUMN IF NOT EXISTS ac_proceso_psicologico TEXT;
