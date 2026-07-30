-- ─────────────────────────────────────────────────────────────
-- AVI — Migración: columna tier en subscriptions
-- Distingue entre plan AVI Esencial y AVI Clínico
-- Pegar en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS tier text
    NOT NULL
    DEFAULT 'esencial'
    CHECK (tier IN ('esencial', 'clinico'));

-- Índice para consultas rápidas de acceso
CREATE INDEX IF NOT EXISTS idx_subs_tier
  ON public.subscriptions(tier);

-- Actualizar la vista therapist_access para incluir el tier
CREATE OR REPLACE VIEW public.therapist_access AS
  SELECT
    therapist_id,
    patient_slots,
    plan,
    tier,
    status,
    CASE
      WHEN status IN ('active', 'free_approved', 'trialing') THEN true
      ELSE false
    END AS has_access
  FROM public.subscriptions;
