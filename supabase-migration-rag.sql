-- ─────────────────────────────────────────────────────────────
-- AVI — MIGRACIÓN RAG (ConsultoriaFuentes con pgvector)
-- Pegar en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────

-- 1. Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabla de chunks con embeddings
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id           BIGSERIAL PRIMARY KEY,
  doc_name     TEXT NOT NULL,          -- nombre del archivo fuente (e.g. "Virginia Satir")
  chunk_index  INTEGER NOT NULL,       -- índice del chunk dentro del doc
  content      TEXT NOT NULL,          -- texto del chunk (~400 palabras)
  embedding    VECTOR(1536),           -- embedding OpenAI text-embedding-3-small
  metadata     JSONB,                  -- datos extra (sección, página, etc.)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índice de similitud coseno (IVFFlat — rápido para búsqueda aproximada)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- 4. Función de búsqueda semántica (llamada desde el servidor)
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(1536),
  match_count     INTEGER DEFAULT 8,
  min_similarity  FLOAT DEFAULT 0.3
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

-- 5. RLS — solo el servidor puede leer (anon no tiene acceso)
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Service role (backend) puede hacer todo; anon y authenticated solo leen
CREATE POLICY "service_role_all" ON public.document_chunks
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "authenticated_read" ON public.document_chunks
  FOR SELECT USING (auth.role() = 'authenticated');
