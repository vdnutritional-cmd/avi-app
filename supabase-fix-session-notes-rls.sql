-- Fix RLS para therapist_session_notes
-- Agrega WITH CHECK explícito para cubrir INSERT correctamente

DROP POLICY IF EXISTS "tsn: terapeuta gestiona sus notas" ON public.therapist_session_notes;

CREATE POLICY "tsn: terapeuta gestiona sus notas"
  ON public.therapist_session_notes FOR ALL
  USING (auth.uid() = therapist_id)
  WITH CHECK (auth.uid() = therapist_id);
