-- ─────────────────────────────────────────────────────────────
-- AVI — FIX: Cambiar dimensión de embeddings 1536 → 768
-- (OpenAI usaba 1536, Google Gemini usa 768)
-- Pegar en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────

-- 1. Eliminar índice anterior (depende de la dimensión)
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- 2. Eliminar función anterior (depende de la dimensión en su firma)
DROP FUNCTION IF EXISTS match_document_chunks(VECTOR(1536), INTEGER, FLOAT);

-- 3. Cambiar la columna a 768 dimensiones (Gemini)
ALTER TABLE public.document_chunks
  ALTER COLUMN embedding TYPE VECTOR(768);

-- 4. Recrear índice con nueva dimensión
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- 5. Recrear función con nueva dimensión
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(768),
  match_count     INTEGER DEFAULT 8,
  min_similarity  FLOAT DEFAULT 0.25
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
  RETURN QUERY
  SELECT
    dc.id,
    dc.doc_name,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) > min_similarity
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
