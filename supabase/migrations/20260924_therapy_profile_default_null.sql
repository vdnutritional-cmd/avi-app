-- Sprint 24: therapy_profile default NULL
-- Los terapeutas nuevos deben configurar su enfoque antes de acceder a pacientes.
-- Los terapeutas existentes que ya tenían 'famsis' (default previo) lo conservan.

ALTER TABLE public.profiles
  ALTER COLUMN therapy_profile SET DEFAULT NULL;
