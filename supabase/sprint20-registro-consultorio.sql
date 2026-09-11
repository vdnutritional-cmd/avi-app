-- ============================================================
-- Sprint 20 — Registro en consultorio (QR por terapeuta)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar columna registro_token a profiles (solo terapeutas la usan)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registro_token uuid DEFAULT gen_random_uuid();

-- 2. Generar token para terapeutas que aún no tengan uno
UPDATE public.profiles
  SET registro_token = gen_random_uuid()
  WHERE role = 'therapist'
    AND registro_token IS NULL;

-- 3. Índice único para búsqueda por token (validación rápida)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_registro_token_idx
  ON public.profiles(registro_token)
  WHERE registro_token IS NOT NULL;

-- 4. Policy: el terapeuta puede leer su propio token
-- (profiles ya tiene SELECT para el propio usuario, este index es suficiente)

-- Verificar:
-- SELECT id, full_name, registro_token FROM public.profiles WHERE role = 'therapist' LIMIT 5;
