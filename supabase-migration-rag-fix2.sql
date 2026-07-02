-- ─────────────────────────────────────────────────────────────
-- AVI — FIX 2: Regresar dimensión de embeddings 768 → 1536
-- (OpenAI text-embedding-3-small usa 1536 dimensiones)
-- Pegar en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS document_chunks_embedding_idx;
DROP FUNCTION IF EXISTS match_document_chunks(VECTOR(768), INTEGER, FLOAT);

ALTER TABLE public.document_chunks
  ALTER COLUMN embedding TYPE VECTOR(1536);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(1536),
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
