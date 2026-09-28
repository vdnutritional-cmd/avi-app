-- ═══════════════════════════════════════════════════════════════════════════
-- Sprint 2 — Corrección de nombres y tipos
-- Corrige las diferencias entre la migración base (20260927_sprint2_base_schema)
-- y el plan documentado original.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. profiles — renombrar politica_baja_activa → politica_baja TEXT
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  DROP COLUMN IF EXISTS politica_baja_activa;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS politica_baja text NOT NULL DEFAULT 'auto';


-- ───────────────────────────────────────────────────────────────────────────
-- 2. therapist_patients — corregir tipos y nombres
-- ───────────────────────────────────────────────────────────────────────────

-- sensacion_paciente_inicial: era smallint, debe ser TEXT DEFAULT 'n/a'
ALTER TABLE therapist_patients
  DROP COLUMN IF EXISTS sensacion_paciente_inicial;

ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS sensacion_paciente_inicial text NOT NULL DEFAULT 'n/a';

-- factores_riesgo_iniciales → factores_riesgo_sel JSONB
ALTER TABLE therapist_patients
  DROP COLUMN IF EXISTS factores_riesgo_iniciales;

ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS factores_riesgo_sel jsonb NOT NULL DEFAULT '[]';

-- factores_proteccion_iniciales → factores_proteccion_sel JSONB
ALTER TABLE therapist_patients
  DROP COLUMN IF EXISTS factores_proteccion_iniciales;

ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS factores_proteccion_sel jsonb NOT NULL DEFAULT '[]';

-- frecuencia_sesiones: eliminar el CHECK constraint incorrecto ('quincenal')
-- y redefinir sin constraint (el valor correcto es 'cada_2_semanas', no 'quincenal')
ALTER TABLE therapist_patients
  DROP COLUMN IF EXISTS frecuencia_sesiones;

ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS frecuencia_sesiones text
    CHECK (frecuencia_sesiones IS NULL OR frecuencia_sesiones IN ('semanal', 'cada_2_semanas', 'mensual'));


-- ───────────────────────────────────────────────────────────────────────────
-- 3. therapist_session_notes — renombrar columnas de emociones y recursos
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE therapist_session_notes
  DROP COLUMN IF EXISTS emociones_identificadas;

ALTER TABLE therapist_session_notes
  ADD COLUMN IF NOT EXISTS session_emociones text;

ALTER TABLE therapist_session_notes
  DROP COLUMN IF EXISTS recursos_personales;

ALTER TABLE therapist_session_notes
  ADD COLUMN IF NOT EXISTS session_recursos text;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. Eliminar tabla derivaciones_cierres (estructura incorrecta)
--    y crear patient_derivaciones_cierres con UNIQUE por par
-- ───────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS derivaciones_cierres CASCADE;

CREATE TABLE IF NOT EXISTS patient_derivaciones_cierres (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id                uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id                  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Derivaciones
  derivacion_tipos            jsonb       NOT NULL DEFAULT '[]',  -- ['Psicólogo','Psiquiatra',...]
  caso_riesgo                 text        NOT NULL DEFAULT 'No aplica',
  asistencia_seguimiento      text        NOT NULL DEFAULT 'No aplica',
  atencion_especializada      text        NOT NULL DEFAULT 'No aplica',
  atencion_especializada_cual text,

  -- Cierres
  percepcion_alivio           text        NOT NULL DEFAULT 'NO',
  sensacion_paciente_final    text        NOT NULL DEFAULT 'n/a',
  cambio_funcionamiento       text        NOT NULL DEFAULT 'NO',
  abandono                    boolean     NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (therapist_id, patient_id)  -- un registro por par; se actualiza con upsert
);

ALTER TABLE patient_derivaciones_cierres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta ve sus propias derivaciones"
  ON patient_derivaciones_cierres FOR SELECT
  USING (auth.uid() = therapist_id);

CREATE POLICY "Terapeuta inserta sus derivaciones"
  ON patient_derivaciones_cierres FOR INSERT
  WITH CHECK (auth.uid() = therapist_id);

CREATE POLICY "Terapeuta actualiza sus derivaciones"
  ON patient_derivaciones_cierres FOR UPDATE
  USING (auth.uid() = therapist_id);

CREATE OR REPLACE FUNCTION update_patient_derivaciones_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_derivaciones_updated_at ON patient_derivaciones_cierres;
CREATE TRIGGER trg_patient_derivaciones_updated_at
  BEFORE UPDATE ON patient_derivaciones_cierres
  FOR EACH ROW EXECUTE FUNCTION update_patient_derivaciones_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- 5. convenio_personas_institucionales — nivel INTEGER (sin cambio de tipo,
--    smallint y integer son equivalentes en Postgres; se deja como está)
-- ───────────────────────────────────────────────────────────────────────────
-- Sin cambios necesarios. El tipo smallint acepta los mismos valores 1/2/3.
