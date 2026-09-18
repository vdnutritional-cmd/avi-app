-- ============================================================
-- MIGRACIÓN: Agregar columnas de Datos Generales a patient_expediente
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-09-18
-- Contexto: Las columnas asesorado_*, contacto_*, pareja_*,
--           hijos y salud_* no existían en la tabla — por eso
--           el registro vía QR no guardaba Datos Generales.
-- ============================================================

ALTER TABLE public.patient_expediente

  -- ── Datos del Asesorado ───────────────────────────────────
  ADD COLUMN IF NOT EXISTS asesorado_nombre            TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS asesorado_sexo              TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS asesorado_edad              TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS asesorado_fecha_nacimiento  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS asesorado_lugar_nacimiento  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS asesorado_estado_civil      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS asesorado_escolaridad       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS asesorado_ocupacion         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS asesorado_religion          TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS asesorado_parroquia         TEXT DEFAULT '',

  -- ── Contacto ──────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS contacto_telefono           TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS contacto_domicilio          TEXT DEFAULT '',

  -- ── Pareja ────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS pareja_nombre               TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pareja_sexo                 TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pareja_edad                 TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pareja_fecha_nacimiento     TEXT DEFAULT '',

  -- ── Hijos (array JSON de hasta 6 hijos) ──────────────────
  ADD COLUMN IF NOT EXISTS hijos                       JSONB DEFAULT '[]'::jsonb,

  -- ── Salud ─────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS salud_padece_enfermedad     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS salud_ayuda_psicologica     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS salud_ayuda_tiempo          TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS salud_medicamentos          TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS salud_medicamentos_cual     TEXT DEFAULT '',

  -- ── Tipo de caso (usado en ExpedienteTab) ─────────────────
  ADD COLUMN IF NOT EXISTS tipo_caso                   TEXT DEFAULT '';

-- Verificación: muestra las columnas recién agregadas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'patient_expediente'
  AND column_name IN (
    'asesorado_nombre', 'asesorado_sexo', 'asesorado_edad',
    'contacto_telefono', 'contacto_domicilio',
    'pareja_nombre', 'hijos',
    'salud_padece_enfermedad', 'tipo_caso'
  )
ORDER BY column_name;
