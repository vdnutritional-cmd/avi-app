-- ─────────────────────────────────────────────────
-- Análisis Clínicos — nuevas columnas en patient_expediente
-- Ejecutar en Supabase SQL Editor
-- ─────────────────────────────────────────────────

ALTER TABLE patient_expediente
  -- Índice de apartados visibles (array de IDs)
  ADD COLUMN IF NOT EXISTS ac_apartados_visibles TEXT[] DEFAULT ARRAY['genograma','mcmaster','foda']::TEXT[],

  -- Genograma
  ADD COLUMN IF NOT EXISTS ac_genograma_url           TEXT,
  ADD COLUMN IF NOT EXISTS ac_genograma_interpretacion TEXT,

  -- Análisis McMaster
  ADD COLUMN IF NOT EXISTS ac_mcmaster_archivo1_url   TEXT,
  ADD COLUMN IF NOT EXISTS ac_mcmaster_archivo2_url   TEXT,
  ADD COLUMN IF NOT EXISTS ac_mcmaster_valores         JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ac_mcmaster_interpretacion  TEXT,

  -- Análisis FODA
  ADD COLUMN IF NOT EXISTS ac_foda_url                TEXT,
  ADD COLUMN IF NOT EXISTS ac_foda_interpretacion     TEXT;
