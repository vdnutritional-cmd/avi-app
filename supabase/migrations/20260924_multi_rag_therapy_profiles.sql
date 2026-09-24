-- ─────────────────────────────────────────────────────────────
-- AVI — Sprint 24: Arquitectura Multi-RAG con therapy_profiles
-- Pegar en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────

-- 1. Nueva columna en document_chunks
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS therapy_profiles text[] DEFAULT '{}';

-- 2. Índice GIN para filtros eficientes con operador @>
CREATE INDEX IF NOT EXISTS idx_chunks_therapy_profiles
  ON public.document_chunks USING GIN (therapy_profiles);

-- 3. Nueva columna en profiles (perfil activo del terapeuta)
--    Default 'famsis' = Personalismo + Familiar Sistémico
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS therapy_profile text DEFAULT 'famsis';

-- 4. Actualizar función RPC: agregar parámetro filter_profile
--    Si no es NULL, filtra chunks cuyo therapy_profiles contiene ese perfil.
--    Mantiene compatibilidad con filter_books (para analisis-clinicos con McMaster).
DROP FUNCTION IF EXISTS match_document_chunks(VECTOR(1536), INTEGER, FLOAT, TEXT[]);

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(1536),
  match_count     INTEGER  DEFAULT 8,
  min_similarity  FLOAT    DEFAULT 0.25,
  filter_books    TEXT[]   DEFAULT NULL,
  filter_profile  TEXT     DEFAULT NULL
)
RETURNS TABLE (
  id          BIGINT,
  doc_name    TEXT,
  chunk_index INTEGER,
  content     TEXT,
  similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  SET LOCAL ivfflat.probes = 5;

  RETURN QUERY
  SELECT
    dc.id,
    dc.doc_name,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE
    -- Filtro por perfil (therapy_profiles @> ARRAY[perfil])
    (filter_profile IS NULL OR dc.therapy_profiles @> ARRAY[filter_profile])
    -- Filtro por libro (para analisis-clinicos — McMaster, etc.)
    AND (filter_books IS NULL OR EXISTS (
      SELECT 1 FROM unnest(filter_books) b(name)
      WHERE dc.doc_name ILIKE '%' || b.name || '%'
    ))
    AND 1 - (dc.embedding <=> query_embedding) > min_similarity
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
