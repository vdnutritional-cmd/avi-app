/**
 * AVI — Recuperación RAG por enfoque terapéutico
 * Sprint 24: Multi-RAG con filtro por therapy_profile del terapeuta
 * 18 oct 2026: búsqueda separada por enfoque (con dos enfoques, cada uno tiene su cupo)
 * y nombre de los enfoques para los prompts. ConsultoriaFuentes (RAG original) ya no existe.
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

// ─── Enfoques terapéuticos y sus libros ──────────────────────────────────────
// Mismos doc_name que genera scripts/index-fuentes.ts (carpetas docs-*).
// Al indexar un libro nuevo en docs-familiar-sistemico / docs-trec / docs-cognitivo-conductual
// / docs-personalismo, agregarlo aquí también.
export const ENFOQUES: Record<string, { nombre: string; libros: string[] }> = {
  famsis: {
    nombre: 'Terapia Familiar Sistémica',
    libros: [
      'Tecnicas de Terapia Familiar Minuchin',
      'Virginia Satir Relaciones Humanas Nucleo Familiar',
      'El Ciclo Vital de La Familia',
      'Apego Influencia Familia',
      'GOTTMAN Conflictos de Pareja',
      'Trabajo con Ninos',
    ],
  },
  trec: {
    nombre: 'Terapia Racional Emotivo-Conductual (TREC)',
    libros: ['TREC Lega Caballo Ellis', 'Beck Manual TCC'],
  },
  cc: {
    nombre: 'Terapia Cognitivo-Conductual (TCC)',
    libros: ['Beck Manual TCC'],
  },
}

// Base común de todos los enfoques (docs-personalismo). No se nombra en la app.
const LIBROS_BASE = [
  'Wojtyla Persona y Accion',
  'Burgos Reconstruir La Persona Ensayos Personalistas',
  'Buber Filosofia del Dialogo',
  'Apuntes Teologia del Cuerpo',
  'El amor Humano en el Plan divino',
  'Supervision de Casos',
]

/** 'famsis_trec' → ['famsis', 'trec'] (solo enfoques conocidos; sin configurar → famsis) */
export function enfoquesDe(therapyProfile: string | null | undefined): string[] {
  const ids = (therapyProfile ?? '').split('_').filter(id => id in ENFOQUES)
  return ids.length > 0 ? ids : ['famsis']
}

/** 'famsis_trec' → "Terapia Familiar Sistémica y Terapia Racional Emotivo-Conductual (TREC)" */
export function nombreEnfoques(therapyProfile: string | null | undefined): string {
  return enfoquesDe(therapyProfile).map(id => ENFOQUES[id].nombre).join(' y ')
}

/**
 * Instrucción común para los prompts de análisis: con qué enfoque(s) trabajar.
 * Con dos enfoques pide integrarlos, no quedarse con uno.
 */
export function instruccionEnfoque(therapyProfile: string | null | undefined): string {
  const ids = enfoquesDe(therapyProfile)
  const nombres = nombreEnfoques(therapyProfile)
  const lineas = [
    `ENFOQUE TERAPÉUTICO DEL TERAPEUTA: ${nombres}.`,
    `Fundamenta el análisis en las FUENTES CLÍNICAS proporcionadas: pasajes de ${ids.length > 1 ? 'esos enfoques' : 'ese enfoque'} y de la base común sobre la persona.`,
    'Cada pasaje indica su fuente y su enfoque.',
  ]
  if (ids.length > 1) {
    lineas.push(
      `El terapeuta eligió DOS enfoques. Intégralos: aplica ${ENFOQUES[ids[0]].nombre} y ${ENFOQUES[ids[1]].nombre} donde cada uno aporte al caso; no te quedes solo con uno.`
    )
  }
  return lineas.join('\n')
}

type Chunk = { id: number; doc_name: string; content: string; similarity: number }

async function buscar(embedding: number[], libros: string[], matchCount: number): Promise<Chunk[]> {
  if (matchCount <= 0) return []
  const { data, error } = await getSupabaseAdmin().rpc('match_document_chunks', {
    query_embedding: embedding,
    match_count:     matchCount,
    min_similarity:  0.20,
    filter_books:    libros,
  })
  if (error) {
    console.error('[RAG] Error búsqueda semántica:', error.message)
    return []
  }
  return (data ?? []) as Chunk[]
}

// ─── Función principal: fuentes del enfoque del terapeuta ─────────────────────
// Usar en todos los análisis del terapeuta (/api/analysis, /api/expediente-analysis,
// /api/analisis-clinicos, /api/session-insights).
// Una búsqueda por enfoque + una de la base común: con dos enfoques, ninguno desplaza al otro
// (antes, en famsis_trec, los 16 pasajes salían de Familiar Sistémica y ninguno de TREC).
export async function retrieveChunksByProfile(
  caseContext: string,
  therapyProfile: string,   // 'famsis' | 'trec' | 'cc' | 'famsis_trec' | 'famsis_cc' | 'trec_cc'
  matchCount = 16
): Promise<string> {
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: caseContext.slice(0, 8000),
  })
  const embedding = embeddingResponse.data[0].embedding

  // Cupos: ~1/4 base común, el resto repartido por igual entre los enfoques
  const ids = enfoquesDe(therapyProfile)
  const cupoBase = Math.max(2, Math.round(matchCount / 4))
  const cupoEnfoque = Math.max(2, Math.floor((matchCount - cupoBase) / ids.length))

  const [base, ...porEnfoque] = await Promise.all([
    buscar(embedding, LIBROS_BASE, cupoBase),
    ...ids.map(id => buscar(embedding, ENFOQUES[id].libros, cupoEnfoque)),
  ])

  // Etiqueta de enfoque por pasaje (Beck pertenece a TREC y a TCC: queda en el primero)
  const vistos = new Set<number>()
  const listas = porEnfoque.map((chunks, i) => chunks
    .filter(c => !vistos.has(c.id) && vistos.add(c.id))
    .map(c => ({ ...c, enfoque: ENFOQUES[ids[i]].nombre })))
  listas.push(base.filter(c => !vistos.has(c.id)).map(c => ({ ...c, enfoque: 'Base común' })))

  // Intercalados (1º de cada enfoque, 2º de cada enfoque…): si un prompt recorta las fuentes,
  // siguen llegando pasajes de todos los enfoques
  const intercalados: (Chunk & { enfoque: string })[] = []
  for (let i = 0; intercalados.length < listas.reduce((n, l) => n + l.length, 0); i++) {
    for (const lista of listas) if (lista[i]) intercalados.push(lista[i])
  }

  const resumen = listas.map(l => `${l[0]?.enfoque ?? '—'}: ${l.length}`).join(' · ')
  if (intercalados.length === 0) {
    console.warn(`[RAG] Sin chunks para perfil: ${therapyProfile}`)
    return ''
  }
  console.log(`[RAG] ${intercalados.length} chunks — perfil: ${therapyProfile} (${resumen})`)
  return intercalados
    .map(c => `### ${c.doc_name} — ${c.enfoque}\n\n${c.content}`)
    .join('\n\n---\n\n')
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
