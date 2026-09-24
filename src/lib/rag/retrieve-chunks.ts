/**
 * AVI — Recuperación RAG de ConsultoriaFuentes
 * Sprint 24: Multi-RAG con filtro por therapy_profile del terapeuta
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Función principal: filtra por perfil terapéutico del terapeuta ───────────
// Usar en: /api/analysis, /api/patterns, /api/historia-clinica
export async function retrieveChunksByProfile(
  caseContext: string,
  therapyProfile: string,   // 'famsis' | 'trec' | 'cc' | 'famsis_trec' | 'famsis_cc' | 'trec_cc'
  matchCount = 16
): Promise<string> {
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: caseContext.slice(0, 8000),
  })
  const queryEmbedding = embeddingResponse.data[0].embedding

  const supabase = getSupabaseAdmin()
  const { data: chunks, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: queryEmbedding,
    match_count:     matchCount,
    min_similarity:  0.20,
    filter_profile:  therapyProfile,
  })

  if (error) {
    console.error(`[RAG] Error búsqueda semántica (perfil: ${therapyProfile}):`, error.message)
    return ''
  }

  if (!chunks || chunks.length === 0) {
    console.warn(`[RAG] Sin chunks para perfil: ${therapyProfile}`)
    return ''
  }

  console.log(`[RAG] ${chunks.length} chunks — perfil: ${therapyProfile}`)
  return formatChunks(chunks as { doc_name: string; content: string }[])
}

// ─── Para analisis-clinicos: filtra por nombre de libro específico ────────────
// Usar en: /api/analisis-clinicos (McMaster, Genograma, FODA, etc.)
export async function retrieveChunksFromBooks(
  caseContext: string,
  books: string[],
  matchCount = 12
): Promise<string> {
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: caseContext.slice(0, 8000),
  })
  const queryEmbedding = embeddingResponse.data[0].embedding

  const supabase = getSupabaseAdmin()
  const { data: chunks, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: queryEmbedding,
    match_count:     matchCount,
    min_similarity:  0.15,
    filter_books:    books,
  })

  if (error) {
    console.error('[RAG] Error búsqueda semántica (libros):', error.message)
    return ''
  }
  if (!chunks || chunks.length === 0) {
    console.warn('[RAG] Sin chunks en libros:', books)
    return ''
  }

  console.log(`[RAG] ${chunks.length} chunks de ${books.join(', ')}`)
  return formatChunks(chunks as { doc_name: string; content: string }[])
}

// ─── Fallback sin filtro (compatibilidad con código legacy) ───────────────────
export async function retrieveRelevantChunks(
  caseContext: string,
  matchCount = 16
): Promise<string> {
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: caseContext.slice(0, 8000),
  })
  const queryEmbedding = embeddingResponse.data[0].embedding

  const supabase = getSupabaseAdmin()
  const { data: chunks, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: queryEmbedding,
    match_count:     matchCount,
    min_similarity:  0.20,
  })

  if (error) {
    console.error('[RAG] Error en búsqueda semántica:', error.message)
    return ''
  }
  if (!chunks || chunks.length === 0) {
    console.warn('[RAG] Sin chunks relevantes encontrados')
    return ''
  }

  console.log(`[RAG] ${chunks.length} chunks recuperados (sin filtro de perfil)`)
  return formatChunks(chunks as { doc_name: string; content: string }[])
}

// ─── Formateador compartido ───────────────────────────────────────────────────
function formatChunks(chunks: { doc_name: string; content: string }[]): string {
  const grouped = new Map<string, string[]>()
  for (const chunk of chunks) {
    const existing = grouped.get(chunk.doc_name) ?? []
    existing.push(chunk.content)
    grouped.set(chunk.doc_name, existing)
  }

  const sections: string[] = []
  for (const [docName, contents] of grouped.entries()) {
    sections.push(`### ${docName}\n\n${contents.join('\n\n[...]\n\n')}`)
  }
  return sections.join('\n\n---\n\n')
}

// ─── Constructor de query RAG desde parámetros clínicos ──────────────────────
export function buildRagQuery(params: {
  initialNote: string
  recentPatterns: Array<{
    summary: string
    emotionalPatterns: string[]
    predominantEmotions: string[]
  }>
  lastInPersonSession?: {
    notes: string
    sessionNumber: number
  }
}): string {
  const parts: string[] = []

  if (params.initialNote?.trim()) {
    parts.push(`CASO: ${params.initialNote.slice(0, 1500)}`)
  }

  const recent = params.recentPatterns.slice(-3)
  if (recent.length > 0) {
    const patternTexts = recent.map(p => [
      p.summary,
      p.emotionalPatterns.join(', '),
      p.predominantEmotions.join(', '),
    ].filter(Boolean).join(' | ')).join(' | ')

    parts.push(`SESIONES AVI RECIENTES: ${patternTexts.slice(0, 1000)}`)
  }

  if (params.lastInPersonSession?.notes?.trim()) {
    parts.push(`ÚLTIMA SESIÓN PRESENCIAL (${params.lastInPersonSession.sessionNumber}): ${params.lastInPersonSession.notes.slice(0, 1000)}`)
  }

  return parts.join('\n\n')
}
