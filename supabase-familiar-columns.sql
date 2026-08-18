-- Migración: columnas sección Familiar en patient_expediente
-- Ejecutar en Supabase → SQL Editor

ALTER TABLE patient_expediente
  ADD COLUMN IF NOT EXISTS fam_sintomas              TEXT,
  ADD COLUMN IF NOT EXISTS fam_detonadores           TEXT,
  ADD COLUMN IF NOT EXISTS fam_factores_riesgo       TEXT,
  ADD COLUMN IF NOT EXISTS fam_funciones             JSONB    DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fam_maternaje             TEXT[],
  ADD COLUMN IF NOT EXISTS fam_paternaje             TEXT[],
  ADD COLUMN IF NOT EXISTS fam_disfunc_tipo          TEXT,
  ADD COLUMN IF NOT EXISTS fam_disfunc_opciones      TEXT[],
  ADD COLUMN IF NOT EXISTS fam_tipo_disfunc          TEXT[],
  ADD COLUMN IF NOT EXISTS fam_ciclo_vital           TEXT,
  ADD COLUMN IF NOT EXISTS fam_ciclo_vital_analisis  TEXT,
  ADD COLUMN IF NOT EXISTS fam_procesos_analisis     TEXT;
