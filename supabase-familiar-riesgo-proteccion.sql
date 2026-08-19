-- Migración: agregar columnas de factores de riesgo y protección (arrays)
-- Reemplaza el campo de texto libre fam_factores_riesgo por dos arrays estructurados.

ALTER TABLE patient_expediente
  ADD COLUMN IF NOT EXISTS fam_riesgo_items      TEXT[],
  ADD COLUMN IF NOT EXISTS fam_proteccion_items   TEXT[];
