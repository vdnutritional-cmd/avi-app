-- Sprint 12 — Información General del Asesorado
-- Agrega 4 columnas a patient_expediente para capturar
-- la sección "INFORMACIÓN GENERAL" del registro QR.

ALTER TABLE patient_expediente
  ADD COLUMN IF NOT EXISTS info_asesoria_anterior  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS info_asesoria_con_quien TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS info_razon_eleccion     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS info_expectativas       TEXT DEFAULT '';
