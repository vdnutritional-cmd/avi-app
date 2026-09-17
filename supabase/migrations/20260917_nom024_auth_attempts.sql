-- ============================================================
-- NOM-024-SSA3-2012 — Rate limiting: tabla auth_attempts
-- Registro de intentos de autenticación (exitosos y fallidos)
-- Ejecutar en Supabase SQL Editor si no existe ya
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        NOT NULL,
  ip_address text,
  success    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_email_idx
  ON public.auth_attempts(email, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_attempts_created_idx
  ON public.auth_attempts(created_at);

-- RLS: bloqueado para usuarios normales.
-- Solo service_role (SUPABASE_SERVICE_ROLE_KEY) puede leer/escribir.
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_attempts_no_access" ON public.auth_attempts;
CREATE POLICY "auth_attempts_no_access" ON public.auth_attempts
  USING (false);
