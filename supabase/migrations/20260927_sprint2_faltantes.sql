-- ═══════════════════════════════════════════════════════════════════════════
-- Sprint 2 — Columnas faltantes
-- Agrega las columnas que quedaron fuera de las migraciones base y corrección.
-- SQL ya ejecutado manualmente en Supabase el 2026-09-27.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. profiles — bloqueo_manual (Cambio I)
--    Permite al terapeuta bloquear un paciente de forma inmediata desde la
--    lista de pacientes, independientemente de la política de inactividad.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bloqueo_manual boolean NOT NULL DEFAULT false;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. therapist_patients — frecuencia_config (Cambio IX)
--    Cadencia de sesiones configurada en la Nota Inicial por el terapeuta.
--    Separada de frecuencia_sesiones (usada por el cron de inactividad).
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS frecuencia_config text
    CHECK (frecuencia_config IS NULL OR frecuencia_config IN ('semanal', 'cada_2_semanas', 'mensual'));
