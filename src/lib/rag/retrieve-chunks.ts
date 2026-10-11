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

// ─── Chat del paciente (AVI-Consúltame): base personalista ───────────────────
// 5 libros de docs-personalismo (mismos doc_name que genera scripts/index-fuentes.ts).
// Sin "Supervision de Casos": es para terapeutas, no para la conversación con el paciente.
export const LIBROS_PERSONALISMO = [
  'Wojtyla Persona y Accion',
  'Burgos Reconstruir La Persona Ensayos Personalistas',
  'Buber Filosofia del Dialogo',
  'Apuntes Teologia del Cuerpo',
  'El amor Humano en el Plan divino',
]

/**
 * Pasajes personalistas para el chat del paciente (máximo uno por libro), SIN nombres de libros ni autores
 * (AVI no debe citarlos). Se llama una vez por sesión; el texto se guarda en
 * sessions.rag_personalista para que el prompt sea idéntico en cada intercambio.
 */
export async function retrievePasajesPersonalismo(consulta: string, matchCount = 3): Promise<string> {
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: consulta.slice(0, 8000),
  })
  // Se piden más candidatos y se toma el mejor de cada libro (variedad: 3 libros distintos)
  const { data: chunks, error } = await getSupabaseAdmin().rpc('match_document_chunks', {
    query_embedding: embeddingResponse.data[0].embedding,
    match_count:     80,
    min_similarity:  0.10,
    filter_books:    LIBROS_PERSONALISMO,
  })
  if (error) {
    console.error('[RAG] Error búsqueda personalismo (chat):', error.message)
    return ''
  }
  const candidatos = (chunks ?? []) as { doc_name: string; content: string }[]
  const librosUsados = new Set<string>()
  const lista: { doc_name: string; content: string }[] = []
  for (const c of candidatos) {
    if (librosUsados.has(c.doc_name)) continue
    librosUsados.add(c.doc_name)
    lista.push(c)
    if (lista.length >= matchCount) break
  }
  // Si no hubo suficientes libros distintos, se completa con los siguientes mejores
  // (siempre 3 pasajes: así el bloque fijo pasa el mínimo de caché con margen)
  for (const c of candidatos) {
    if (lista.length >= matchCount) break
    if (!lista.includes(c)) lista.push(c)
  }
  console.log(`[RAG] ${lista.length} pasajes personalistas (chat)`)
  return lista.map((c, i) => `Pasaje ${i + 1}:\n${c.content}`).join('\n\n')
}
