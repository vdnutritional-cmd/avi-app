-- ─────────────────────────────────────────────────────────────
-- Migración: columna status en therapist_patients
-- Permite archivar cuentas temporales después de fusionarlas.
-- 'active'   → aparece en lista de pacientes (valor por defecto)
-- 'archived' → no aparece en lista; cuenta fusionada/archivada
-- ─────────────────────────────────────────────────────────────
ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'archived'));
