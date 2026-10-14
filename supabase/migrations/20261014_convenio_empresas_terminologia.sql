-- Terminología de cada empresa en CONVENIO (14 oct 2026)
--   'paciente'  → paciente / terapeuta / terapia
--   'asesorado' → asesorado / asesor / asesoría
-- Las empresas actuales y las nuevas quedan en 'asesorado'; se cambia en
-- SaaS Controller › Configuración AVI › Empresas en CONVENIO.
-- Los pacientes toman la terminología de su empresa (no se guarda por paciente).
ALTER TABLE convenio_empresas
  ADD COLUMN IF NOT EXISTS terminologia text NOT NULL DEFAULT 'asesorado'
  CHECK (terminologia IN ('paciente', 'asesorado'));
