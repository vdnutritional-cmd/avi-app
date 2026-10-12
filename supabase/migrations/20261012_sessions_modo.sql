-- Sesiones AVI: cómo platicó el paciente (elegido al iniciar; no cambia en la sesión).
-- Las sesiones anteriores quedan sin modo (NULL = antes del registro).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS modo text CHECK (modo IN ('hablada', 'escrita'));
