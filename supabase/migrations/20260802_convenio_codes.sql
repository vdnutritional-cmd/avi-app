-- ─────────────────────────────────────────────────────────────
-- Códigos de acceso para planes en CONVENIO
-- Solo el admin puede generar/gestionar códigos.
-- Los terapeutas los usan una sola vez al hacer checkout.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.convenio_codes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code        TEXT        UNIQUE NOT NULL,
  plan_id     TEXT,                                         -- null = válido para cualquier plan CONVENIO
  used_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,                                  -- null = sin expiración
  is_active   BOOLEAN     DEFAULT true NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Solo service_role (admin) accede directamente
ALTER TABLE public.convenio_codes ENABLE ROW LEVEL SECURITY;

-- Ningún terapeuta puede leer ni escribir directamente
-- La validación siempre pasa por las API routes (service_role)
CREATE POLICY "No acceso público a convenio_codes"
  ON public.convenio_codes
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
