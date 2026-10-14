-- "Cómo me nombran" del terapeuta (14 oct 2026)
-- Palabras para sus personas SIN empresa: 'paciente' (paciente/terapeuta/terapia)
-- o 'asesorado' (asesorado/asesor/asesoría). Por defecto 'paciente'.
-- Lo elige el terapeuta en Configuración › Cómo me nombran.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terminologia text NOT NULL DEFAULT 'paciente'
  CHECK (terminologia IN ('paciente', 'asesorado'));
