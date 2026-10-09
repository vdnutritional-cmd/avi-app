-- ─────────────────────────────────────────────────────────────
-- Migración: motivo de bloqueo en therapist_patients.status
--
-- 'active'   → vínculo normal (puede estar bloqueado por falta de cupo:
--              eso se calcula en src/lib/acceso-paciente.ts, no se guarda)
-- 'archived' → cuenta fusionada / transferida
-- 'inactive' → bloqueado por INACTIVIDAD (cron bloquear-inactivos)
-- 'blocked'  → bloqueado MANUALMENTE por el terapeuta
--
-- Antes el CHECK solo permitía active/archived, así que el cron de
-- inactividad fallaba al escribir 'inactive' y no bloqueaba a nadie.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE therapist_patients DROP CONSTRAINT IF EXISTS therapist_patients_status_check;
ALTER TABLE therapist_patients
  ADD CONSTRAINT therapist_patients_status_check
  CHECK (status IN ('active', 'archived', 'inactive', 'blocked'));

-- Los bloqueados que existen hoy solo pudieron venir del botón "Bloquear"
-- (el cron nunca pudo escribir): se marcan como bloqueo manual.
UPDATE therapist_patients
  SET status = 'blocked'
  WHERE is_active = false AND status = 'active';
