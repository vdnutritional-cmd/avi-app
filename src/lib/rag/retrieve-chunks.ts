/**
 * AVI — Recuperación RAG de ConsultoriaFuentes
 * Usa OpenAI text-embedding-3-small (1536 dimensiones)
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
    match_count: matchCount,
    min_similarity: 0.20,
  })

  if (error) {
    console.error('[RAG] Error en búsqueda semántica:', error.message)
    return ''
  }

  if (!chunks || chunks.length === 0) {
    console.warn('[RAG] Sin chunks relevantes encontrados')
    return ''
  }

  console.log(`[RAG] ${chunks.length} chunks recuperados`)

  const grouped = new Map<string, string[]>()
  for (const chunk of chunks as any[]) {
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

export function buildRagQuery(params: {
  initialNote: string
  recentPatterns: Array<{
    summary: string
    emotionalPatterns: string[]
    predominantEmotions: string[]
  }>
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

    parts.push(`PATRONES RECIENTES: ${patternTexts.slice(0, 1000)}`)
  }

  return parts.join('\n\n')
}
