-- Sprint 12: agregar is_active a profiles para soportar "Desactivar terapeuta"
-- NOM-024 compliant: no borra registros, solo marca al perfil como inactivo.
-- Los terapeutas desactivados desaparecen de reportes e institucional.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Índice para que los filtros WHERE is_active = true sean rápidos
CREATE INDEX IF NOT EXISTS profiles_is_active_idx ON public.profiles (is_active);

COMMENT ON COLUMN public.profiles.is_active IS
  'false = terapeuta desactivado por admin (NOM-024: datos se conservan, solo se oculta de reportes)';
