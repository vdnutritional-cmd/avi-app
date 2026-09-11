-- ============================================================
-- Sprint 19 — Cuestionarios clínicos para pacientes
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.patient_questionnaires (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  therapist_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  questionnaire_type  text        NOT NULL,   -- 'mcmaster_fad' | 'beck_depression' | 'scl90' | 'hamilton_anxiety' | 'otro'
  title               text        NOT NULL,   -- Nombre legible del cuestionario
  status              text        NOT NULL DEFAULT 'pending',  -- 'pending' | 'completed'
  responses           jsonb,                  -- Respuestas del paciente {pregunta_id: valor}
  score               jsonb,                  -- Puntajes calculados por dimensión
  interpretation      text,                   -- Interpretación clínica generada por IA
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS pq_patient_status_idx
  ON public.patient_questionnaires(patient_id, status);

CREATE INDEX IF NOT EXISTS pq_therapist_patient_idx
  ON public.patient_questionnaires(therapist_id, patient_id);

CREATE INDEX IF NOT EXISTS pq_assigned_at_idx
  ON public.patient_questionnaires(assigned_at DESC);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.patient_questionnaires ENABLE ROW LEVEL SECURITY;

-- El paciente ve sus propios cuestionarios
CREATE POLICY "patient_sees_own_questionnaires"
  ON public.patient_questionnaires
  FOR SELECT
  USING (auth.uid() = patient_id);

-- El paciente puede completar (UPDATE) sus cuestionarios pendientes
CREATE POLICY "patient_can_complete_questionnaire"
  ON public.patient_questionnaires
  FOR UPDATE
  USING (auth.uid() = patient_id AND status = 'pending')
  WITH CHECK (auth.uid() = patient_id);

-- El terapeuta ve los cuestionarios de sus pacientes
CREATE POLICY "therapist_sees_patient_questionnaires"
  ON public.patient_questionnaires
  FOR SELECT
  USING (auth.uid() = therapist_id);

-- El terapeuta puede asignar (INSERT) cuestionarios a sus pacientes
CREATE POLICY "therapist_can_assign_questionnaires"
  ON public.patient_questionnaires
  FOR INSERT
  WITH CHECK (
    auth.uid() = therapist_id
    AND EXISTS (
      SELECT 1 FROM public.therapist_patients tp
      WHERE tp.therapist_id = auth.uid()
        AND tp.patient_id = patient_questionnaires.patient_id
        AND tp.status = 'active'
    )
  );

-- El terapeuta puede eliminar (lógicamente) cuestionarios no completados
-- (no se usa DELETE físico — actualizamos status a 'cancelled' en su lugar)
CREATE POLICY "no_delete_questionnaires"
  ON public.patient_questionnaires
  AS RESTRICTIVE
  FOR DELETE
  USING (false);

-- ── Verificación ─────────────────────────────────────────────
-- SELECT COUNT(*) FROM public.patient_questionnaires;  -- debe ser 0
