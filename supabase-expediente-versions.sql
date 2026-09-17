-- ============================================================
-- Sprint 23 — expediente_versions
-- Versionado automático de registros clínicos con diff JSON
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Tabla de versiones
CREATE TABLE IF NOT EXISTS expediente_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla         text NOT NULL,                  -- 'patient_expediente' | 'therapist_session_notes' | 'case_notes'
  registro_id   uuid NOT NULL,                  -- PK del registro que cambió
  paciente_id   uuid REFERENCES profiles(id),   -- para filtrar por paciente
  terapeuta_id  uuid REFERENCES profiles(id),   -- quien hizo el cambio
  accion        text NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')),
  datos_antes   jsonb,                          -- snapshot antes del cambio (null en INSERT)
  datos_despues jsonb,                          -- snapshot después del cambio (null en DELETE)
  diff          jsonb,                          -- solo los campos que cambiaron (UPDATE)
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS idx_expv_tabla_registro ON expediente_versions (tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_expv_paciente       ON expediente_versions (paciente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expv_terapeuta      ON expediente_versions (terapeuta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expv_created        ON expediente_versions (created_at DESC);

-- RLS: solo el terapeuta dueño del paciente y el admin pueden leer
ALTER TABLE expediente_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expediente_versions_select" ON expediente_versions
  FOR SELECT USING (
    auth.uid() = terapeuta_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Sin UPDATE ni DELETE (inmutabilidad del registro de auditoría)
CREATE POLICY "expediente_versions_no_update" ON expediente_versions
  FOR UPDATE USING (false);

CREATE POLICY "expediente_versions_no_delete" ON expediente_versions
  FOR DELETE USING (false);

-- ============================================================
-- Función genérica de auditoría de expediente
-- ============================================================
CREATE OR REPLACE FUNCTION fn_versionar_expediente()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_diff   jsonb := '{}';
  v_key    text;
  v_antes  jsonb;
  v_despues jsonb;
  v_reg_id  uuid;
  v_pac_id  uuid;
  v_ter_id  uuid;
BEGIN
  -- Determinar IDs según tabla
  IF TG_TABLE_NAME = 'patient_expediente' THEN
    v_reg_id  := COALESCE(NEW.id, OLD.id);
    v_pac_id  := COALESCE(NEW.patient_id, OLD.patient_id);
    -- buscar terapeuta dueño del paciente
    SELECT therapist_id INTO v_ter_id
      FROM therapist_patients
     WHERE patient_id = v_pac_id
     LIMIT 1;

  ELSIF TG_TABLE_NAME = 'therapist_session_notes' THEN
    v_reg_id  := COALESCE(NEW.id, OLD.id);
    v_pac_id  := COALESCE(NEW.patient_id, OLD.patient_id);
    v_ter_id  := COALESCE(NEW.therapist_id, OLD.therapist_id);

  ELSIF TG_TABLE_NAME = 'case_notes' THEN
    v_reg_id  := COALESCE(NEW.id, OLD.id);
    v_pac_id  := COALESCE(NEW.patient_id, OLD.patient_id);
    v_ter_id  := COALESCE(NEW.therapist_id, OLD.therapist_id);
  END IF;

  -- Construir snapshots
  IF TG_OP = 'INSERT' THEN
    v_antes   := NULL;
    v_despues := to_jsonb(NEW);
    v_diff    := NULL;

  ELSIF TG_OP = 'DELETE' THEN
    v_antes   := to_jsonb(OLD);
    v_despues := NULL;
    v_diff    := NULL;

  ELSE  -- UPDATE
    v_antes   := to_jsonb(OLD);
    v_despues := to_jsonb(NEW);
    -- Calcular diff: solo campos que cambiaron
    FOR v_key IN SELECT jsonb_object_keys(v_despues) LOOP
      IF (v_despues->v_key) IS DISTINCT FROM (v_antes->v_key) THEN
        v_diff := v_diff || jsonb_build_object(
          v_key,
          jsonb_build_object('antes', v_antes->v_key, 'despues', v_despues->v_key)
        );
      END IF;
    END LOOP;
    -- Si nada cambió (actualización sin modificaciones reales) no registrar
    IF v_diff = '{}' THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  INSERT INTO expediente_versions
    (tabla, registro_id, paciente_id, terapeuta_id, accion, datos_antes, datos_despues, diff)
  VALUES
    (TG_TABLE_NAME, v_reg_id, v_pac_id, v_ter_id, TG_OP, v_antes, v_despues, v_diff);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- Triggers en las 3 tablas clínicas principales
-- ============================================================

-- patient_expediente
DROP TRIGGER IF EXISTS trg_versionar_expediente ON patient_expediente;
CREATE TRIGGER trg_versionar_expediente
  AFTER INSERT OR UPDATE OR DELETE ON patient_expediente
  FOR EACH ROW EXECUTE FUNCTION fn_versionar_expediente();

-- therapist_session_notes
DROP TRIGGER IF EXISTS trg_versionar_session_notes ON therapist_session_notes;
CREATE TRIGGER trg_versionar_session_notes
  AFTER INSERT OR UPDATE OR DELETE ON therapist_session_notes
  FOR EACH ROW EXECUTE FUNCTION fn_versionar_expediente();

-- case_notes
DROP TRIGGER IF EXISTS trg_versionar_case_notes ON case_notes;
CREATE TRIGGER trg_versionar_case_notes
  AFTER INSERT OR UPDATE OR DELETE ON case_notes
  FOR EACH ROW EXECUTE FUNCTION fn_versionar_expediente();
