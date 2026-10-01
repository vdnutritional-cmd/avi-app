-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 11 (XIII): Personas Institucionales por empresa CONVENIO
-- Cada persona es un terapeuta ya registrado en profiles.
-- El admin asigna empresa, nivel de acceso y si opera como terapeuta.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS convenio_personas_institucionales (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid        NOT NULL REFERENCES convenio_empresas(id)  ON DELETE CASCADE,
  therapist_id          uuid        NOT NULL REFERENCES profiles(id)           ON DELETE CASCADE,
  nivel                 text        NOT NULL CHECK (nivel IN ('N1', 'N2', 'N3')),
  opera_como_terapeuta  boolean     NOT NULL DEFAULT true,
  is_active             boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, therapist_id)
);

-- Índices para lookups frecuentes
CREATE INDEX IF NOT EXISTS idx_cpi_empresa    ON convenio_personas_institucionales (empresa_id);
CREATE INDEX IF NOT EXISTS idx_cpi_therapist  ON convenio_personas_institucionales (therapist_id);
