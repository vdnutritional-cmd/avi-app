-- ─────────────────────────────────────────────────────────────
-- Migración: pasajes personalistas por sesión AVI-Consúltame
--
-- Al iniciar una sesión, /api/chat busca 3 pasajes de 5 libros de
-- docs-personalismo (RAG) y los guarda aquí. Toda la sesión reutiliza
-- exactamente el mismo texto → el bloque fijo del prompt queda idéntico
-- en cada intercambio y el caché de Anthropic sí se aprovecha.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS rag_personalista text;
