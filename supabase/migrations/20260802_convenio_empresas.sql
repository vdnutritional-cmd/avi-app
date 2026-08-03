-- ─────────────────────────────────────────────────────────────
-- Empresas en CONVENIO
-- El admin registra aquí las empresas que aparecen en el
-- dropdown de la sección "Paquetes en CONVENIO" de /pricing
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.convenio_empresas (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     TEXT        NOT NULL,
  is_active  BOOLEAN     DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.convenio_empresas ENABLE ROW LEVEL SECURITY;

-- Lectura pública (para el dropdown en /pricing)
CREATE POLICY "Lectura pública de empresas activas"
  ON public.convenio_empresas
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Escritura solo vía service_role (API admin)
-- No se necesita policy de escritura para authenticated
