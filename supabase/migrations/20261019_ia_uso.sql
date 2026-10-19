-- ─────────────────────────────────────────────────────────────
-- AVI — Medición real del costo de IA (19 oct 2026)
-- Guarda los tokens que Anthropic reporta en cada llamada (usage).
-- No cuesta tokens: Anthropic ya los devuelve en cada respuesta.
-- Pegar en Supabase → SQL Editor → Run (antes de subir el código).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ia_uso (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at          timestamptz NOT NULL DEFAULT now(),
  tipo                text        NOT NULL,   -- p. ej. 'analisis_caso', 'prediagnostico', 'chat_avi'
  modelo              text        NOT NULL,
  therapist_id        uuid,
  patient_id          uuid,
  input_tokens        integer     NOT NULL DEFAULT 0,
  output_tokens       integer     NOT NULL DEFAULT 0,
  cache_write_tokens  integer     NOT NULL DEFAULT 0,
  cache_read_tokens   integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ia_uso_tipo_fecha ON public.ia_uso (tipo, created_at);

-- Solo el servidor (service_role) escribe y lee; sin políticas = nadie más tiene acceso
ALTER TABLE public.ia_uso ENABLE ROW LEVEL SECURITY;
