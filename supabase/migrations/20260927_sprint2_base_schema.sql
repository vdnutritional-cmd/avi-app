-- ═══════════════════════════════════════════════════════════════════════════
-- Sprint 2 — Base Schema
-- Migración única con todas las columnas y tablas requeridas por
-- los Sprints 3-11 (cambios I, III, VII, VIII, IX, X, XIII, XIV, XVI, XVII).
--
-- Columnas que YA EXISTEN y no se tocan aquí:
--   therapist_patients.empresa_id        ← migración 20260813
--   patient_expediente.tipo_caso         ← usado en ExpedienteTab (sin migración formal, existe en prod)
--   patient_expediente.fam_riesgo_items  ← migración 20260813 o posterior
--   patient_expediente.fam_proteccion_items ← ídem
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. profiles — Política de baja (Cambio I)
-- ───────────────────────────────────────────────────────────────────────────
-- politica_baja_activa: si TRUE el cron bloqueará automáticamente pacientes
--   inactivos según su frecuencia_sesiones.  Default TRUE (igual al
--   comportamiento actual).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS politica_baja_activa boolean NOT NULL DEFAULT true;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. therapist_patients — Frecuencia + sensación + factores iniciales
--    (Cambios III, VIII, IX)
-- ───────────────────────────────────────────────────────────────────────────
-- frecuencia_sesiones: cadencia acordada con el paciente.
--   Semanal → límite inactividad 15 días
--   Quincenal → límite 30 días
--   Mensual  → límite 45 días
--   NULL     → se usa el límite global (45 días, comportamiento actual)
ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS frecuencia_sesiones text
    CHECK (frecuencia_sesiones IN ('semanal', 'quincenal', 'mensual'));

-- sensacion_paciente_inicial: respuesta del 1 al 10 al inicio de la
--   Sesión Inicial. Guardada junto con la Nota Inicial (Cambio VIII).
ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS sensacion_paciente_inicial smallint
    CHECK (sensacion_paciente_inicial BETWEEN 1 AND 10);

-- Factores de riesgo y protección registrados en la Nota Inicial (Cambio VIII)
ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS factores_riesgo_iniciales    text;

ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS factores_proteccion_iniciales text;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. patient_expediente — Problemática + factores individuales y de pareja
--    (Cambios VII, XVI, XVII)
-- ───────────────────────────────────────────────────────────────────────────
-- problematica: categoría principal de la demanda terapéutica (Cambio VII)
ALTER TABLE patient_expediente
  ADD COLUMN IF NOT EXISTS problematica text
    CHECK (problematica IN (
      'Ansiedad',
      'Depresión',
      'Duelo',
      'Trauma / TEPT',
      'Relaciones de pareja',
      'Conflictos familiares',
      'Crianza y parentalidad',
      'Trastornos alimentarios',
      'Adicciones',
      'Autoestima y desarrollo personal',
      'Manejo del estrés',
      'Orientación vocacional / vida laboral',
      'Problemas de conducta en niños',
      'Habilidades sociales',
      'Identidad y etapa de vida',
      'Sexualidad',
      'Fobias y TOC',
      'Otro'
    ));

-- Factores de riesgo y protección — IndividualTab (Cambio XVI)
-- Almacenados como jsonb (array de objetos {id, label}) igual que FamiliarTab.
ALTER TABLE patient_expediente
  ADD COLUMN IF NOT EXISTS ind_factores_riesgo     jsonb;

ALTER TABLE patient_expediente
  ADD COLUMN IF NOT EXISTS ind_factores_proteccion jsonb;

-- Factores de riesgo y protección — ParejaTab (Cambios XVI, XVII)
ALTER TABLE patient_expediente
  ADD COLUMN IF NOT EXISTS par_factores_riesgo     jsonb;

ALTER TABLE patient_expediente
  ADD COLUMN IF NOT EXISTS par_factores_proteccion jsonb;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. Tabla derivaciones_cierres (Cambio X)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS derivaciones_cierres (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id  uuid        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  patient_id    uuid        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,

  tipo_cierre   text        NOT NULL
    CHECK (tipo_cierre IN (
      'alta_terapeutica',
      'derivacion',
      'abandono',
      'otro'
    )),

  -- Solo aplica si tipo_cierre = 'derivacion'
  institucion_derivacion text,
  profesional_derivacion text,

  fecha_cierre  date        NOT NULL DEFAULT CURRENT_DATE,
  motivo        text,
  notas         text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Un terapeuta puede tener múltiples derivaciones/cierres por paciente,
-- pero solo un cierre activo (el más reciente se usa como estado actual).
CREATE INDEX IF NOT EXISTS idx_derivaciones_therapist_patient
  ON derivaciones_cierres (therapist_id, patient_id, fecha_cierre DESC);

-- RLS
ALTER TABLE derivaciones_cierres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta ve sus propias derivaciones"
  ON derivaciones_cierres FOR SELECT
  USING (auth.uid() = therapist_id);

CREATE POLICY "Terapeuta inserta sus derivaciones"
  ON derivaciones_cierres FOR INSERT
  WITH CHECK (auth.uid() = therapist_id);

CREATE POLICY "Terapeuta actualiza sus derivaciones"
  ON derivaciones_cierres FOR UPDATE
  USING (auth.uid() = therapist_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_derivaciones_cierres_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_derivaciones_cierres_updated_at ON derivaciones_cierres;
CREATE TRIGGER trg_derivaciones_cierres_updated_at
  BEFORE UPDATE ON derivaciones_cierres
  FOR EACH ROW EXECUTE FUNCTION update_derivaciones_cierres_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- 5. Tabla convenio_personas_institucionales (Cambios XIII, XIV)
-- ───────────────────────────────────────────────────────────────────────────
-- Hasta 5 personas por empresa, con 3 niveles de acceso:
--   N1 → acceso completo de terapeuta + todos los reportes institucionales
--   N2 → estadística institucional (pantalla) + reportes N2 imprimibles
--   N3 → solo reportes N3 imprimibles
CREATE TABLE IF NOT EXISTS convenio_personas_institucionales (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid        NOT NULL REFERENCES convenio_empresas(id) ON DELETE CASCADE,

  nombre      text        NOT NULL,
  email       text        NOT NULL,
  nivel       smallint    NOT NULL DEFAULT 2
    CHECK (nivel IN (1, 2, 3)),

  is_active   boolean     NOT NULL DEFAULT true,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Máximo 5 personas por empresa (enforced a nivel app, constraint de apoyo)
  UNIQUE (empresa_id, email)
);

CREATE INDEX IF NOT EXISTS idx_cpi_empresa
  ON convenio_personas_institucionales (empresa_id);

CREATE INDEX IF NOT EXISTS idx_cpi_email
  ON convenio_personas_institucionales (email);

-- RLS: solo admin puede gestionar personas institucionales
ALTER TABLE convenio_personas_institucionales ENABLE ROW LEVEL SECURITY;

-- Las personas institucionales leen sus propios registros para saber su nivel
CREATE POLICY "Persona institucional lee su propio registro"
  ON convenio_personas_institucionales FOR SELECT
  USING (email = (
    SELECT email FROM profiles WHERE id = auth.uid() LIMIT 1
  ));

-- Solo service_role (admin) puede INSERT/UPDATE/DELETE
-- (Las operaciones de admin usan createAdminClient que bypasea RLS)

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_cpi_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cpi_updated_at ON convenio_personas_institucionales;
CREATE TRIGGER trg_cpi_updated_at
  BEFORE UPDATE ON convenio_personas_institucionales
  FOR EACH ROW EXECUTE FUNCTION update_cpi_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- 6. therapist_session_notes — Campos de IA para Sesiones Presenciales
--    (Cambio V — Sprint 5)
-- ───────────────────────────────────────────────────────────────────────────
-- Guardados tras la generación automática por IA. Editables por el terapeuta.
ALTER TABLE therapist_session_notes
  ADD COLUMN IF NOT EXISTS emociones_identificadas text;

ALTER TABLE therapist_session_notes
  ADD COLUMN IF NOT EXISTS recursos_personales      text;
