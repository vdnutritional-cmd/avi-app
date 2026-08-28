-- ─────────────────────────────────────────────────────────────
-- AVI — RAG Performance Fix
-- Cambios:
--   1. Índice B-tree en doc_name (filtro por libro)
--   2. Función actualizada con probes = 5 y filtro por libros en SQL
-- Pegar en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────

-- 1. Índice en doc_name para filtros rápidos por libro
CREATE INDEX IF NOT EXISTS document_chunks_doc_name_idx
  ON public.document_chunks (doc_name);

-- 2. Función actualizada con:
--    - ivfflat.probes = 5 (busca 5/50 listas en vez de 1/50 → 5x más cobertura)
--    - Parámetro filter_books: array de nombres parciales de libro
--      Si es NULL, busca en todos los libros (comportamiento anterior)
DROP FUNCTION IF EXISTS match_document_chunks(VECTOR(1536), INTEGER, FLOAT);

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(1536),
  match_count     INTEGER DEFAULT 8,
  min_similarity  FLOAT  DEFAULT 0.25,
  filter_books    TEXT[] DEFAULT NULL
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
  -- Más listas revisadas → mejor recall sin full-scan
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
    -- Filtro opcional por libro (búsqueda parcial en doc_name)
    (filter_books IS NULL OR EXISTS (
      SELECT 1 FROM unnest(filter_books) b(name)
      WHERE dc.doc_name ILIKE '%' || b.name || '%'
    ))
    AND 1 - (dc.embedding <=> query_embedding) > min_similarity
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
