-- ═══════════════════════════════════════════════════════════════════════════
-- Sprint 4 — Cambio VIII (ampliación)
-- Bloque de Factores de Riesgo y Protección — TREC
-- Dos nuevas columnas JSONB en therapist_patients para la Nota Inicial.
-- Formato del objeto: { individual: string[], familiar: string[], pareja: string[] }
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS factores_riesgo_trec     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS factores_proteccion_trec  jsonb NOT NULL DEFAULT '[]'::jsonb;
