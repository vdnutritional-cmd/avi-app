-- ============================================================
-- NOM-024-SSA3-2012 — Fase 1: Bloquear DELETE físico en tablas clínicas
-- Los registros clínicos NO pueden eliminarse — solo desactivarse (status).
-- Ejecutar en Supabase SQL Editor (service_role)
-- ============================================================

-- patient_expediente
DROP POLICY IF EXISTS "no_delete_expediente" ON public.patient_expediente;
CREATE POLICY "no_delete_expediente"
  ON public.patient_expediente
  AS RESTRICTIVE
  FOR DELETE
  USING (false);

-- therapist_session_notes
DROP POLICY IF EXISTS "no_delete_session_notes" ON public.therapist_session_notes;
CREATE POLICY "no_delete_session_notes"
  ON public.therapist_session_notes
  AS RESTRICTIVE
  FOR DELETE
  USING (false);

-- analyses
DROP POLICY IF EXISTS "no_delete_analyses" ON public.analyses;
CREATE POLICY "no_delete_analyses"
  ON public.analyses
  AS RESTRICTIVE
  FOR DELETE
  USING (false);

-- messages
DROP POLICY IF EXISTS "no_delete_messages" ON public.messages;
CREATE POLICY "no_delete_messages"
  ON public.messages
  AS RESTRICTIVE
  FOR DELETE
  USING (false);

-- therapist_patients (solo soft-delete via columna status)
DROP POLICY IF EXISTS "no_delete_therapist_patients" ON public.therapist_patients;
CREATE POLICY "no_delete_therapist_patients"
  ON public.therapist_patients
  AS RESTRICTIVE
  FOR DELETE
  USING (false);


-- ============================================================
-- Rate limiting — tabla auth_attempts
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

-- RLS: solo service_role puede leer/escribir
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_attempts_no_access" ON public.auth_attempts
  USING (false);

-- Índice para limpieza periódica por fecha
CREATE INDEX IF NOT EXISTS auth_attempts_created_idx
  ON public.auth_attempts(created_at);
