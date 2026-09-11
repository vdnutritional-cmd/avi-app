-- ============================================================
-- NOM-024-SSA3-2012 — Fase 1: Pistas de Auditoría Inmutables
-- Ejecutar en Supabase SQL Editor (service_role)
-- ============================================================

-- 1. Tabla audit_log
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla         text        NOT NULL,
  operacion     text        NOT NULL,  -- INSERT / UPDATE / DELETE
  registro_id   text,
  usuario_id    uuid,
  datos_antes   jsonb,
  datos_despues jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas en panel de auditoría
CREATE INDEX IF NOT EXISTS audit_log_tabla_idx     ON public.audit_log(tabla);
CREATE INDEX IF NOT EXISTS audit_log_usuario_idx   ON public.audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS audit_log_created_idx   ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_operacion_idx ON public.audit_log(operacion);

-- RLS: ningún usuario autenticado puede leer ni escribir directamente.
-- Solo service_role (triggers SECURITY DEFINER) puede insertar.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_no_access" ON public.audit_log
  USING (false);


-- 2. Función trigger de auditoría
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_cambio_clinico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    tabla,
    operacion,
    registro_id,
    usuario_id,
    datos_antes,
    datos_despues
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id::text, OLD.id::text),
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


-- 3. Triggers en tablas clínicas
-- ---------------------------------------------------------------

-- patient_expediente
DROP TRIGGER IF EXISTS audit_patient_expediente ON public.patient_expediente;
CREATE TRIGGER audit_patient_expediente
  AFTER INSERT OR UPDATE OR DELETE ON public.patient_expediente
  FOR EACH ROW EXECUTE FUNCTION public.log_cambio_clinico();

-- therapist_session_notes
DROP TRIGGER IF EXISTS audit_session_notes ON public.therapist_session_notes;
CREATE TRIGGER audit_session_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.therapist_session_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_cambio_clinico();

-- analyses
DROP TRIGGER IF EXISTS audit_analyses ON public.analyses;
CREATE TRIGGER audit_analyses
  AFTER INSERT OR UPDATE OR DELETE ON public.analyses
  FOR EACH ROW EXECUTE FUNCTION public.log_cambio_clinico();

-- messages (sesiones AVI)
DROP TRIGGER IF EXISTS audit_messages ON public.messages;
CREATE TRIGGER audit_messages
  AFTER INSERT OR UPDATE OR DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.log_cambio_clinico();

-- therapist_patients (altas y cambios de vinculación)
DROP TRIGGER IF EXISTS audit_therapist_patients ON public.therapist_patients;
CREATE TRIGGER audit_therapist_patients
  AFTER INSERT OR UPDATE OR DELETE ON public.therapist_patients
  FOR EACH ROW EXECUTE FUNCTION public.log_cambio_clinico();


-- 4. Verificación
-- ---------------------------------------------------------------
-- Después de ejecutar, verifica con:
-- SELECT COUNT(*) FROM public.audit_log;
-- (Debe ser 0 o el número de registros previos si hay datos)
-- Luego haz cualquier UPDATE en patient_expediente y confirma que
-- aparece un registro en audit_log via el panel de admin.
