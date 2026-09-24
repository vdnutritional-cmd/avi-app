/**
 * AVI — Script de indexación RAG Multi-Perfil
 * Sprint 24: Arquitectura therapy_profiles
 *
 * Lee de 5 directorios docs-*/ y asigna therapy_profiles por escuela terapéutica.
 * Detecta archivos duplicados entre directorios y mergea sus tags (ej. Beck en trec + cc).
 *
 * Ejecutar para re-indexar (borra todos los chunks anteriores):
 *   npx tsx scripts/index-fuentes.ts
 *
 * Requiere en .env.local:
 *   OPENAI_API_KEY=sk-...
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=ey...
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { config } from 'dotenv'

config({ path: path.join(process.cwd(), '.env.local') })

const CHUNK_SIZE    = 400   // palabras por chunk
const CHUNK_OVERLAP = 50    // palabras de solapamiento
const BATCH_SIZE    = 20    // embeddings en paralelo

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Mapa de directorio → perfiles en que participan sus chunks ───────────────
// Personalismo es base obligatoria de todos los perfiles.
// Cada escuela aparece solo en los perfiles que la incluyen.
const DIR_PROFILE_MAP: Record<string, string[]> = {
  'docs-personalismo':        ['famsis', 'trec', 'cc', 'famsis_trec', 'famsis_cc', 'trec_cc', 'analisis'],
  'docs-familiar-sistemico':  ['famsis', 'famsis_trec', 'famsis_cc'],
  'docs-trec':                ['trec',   'famsis_trec', 'trec_cc'],
  'docs-cognitivo-conductual':['cc',     'famsis_cc',   'trec_cc'],
  'docs-analisis':            ['analisis'],
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface DocEntry {
  archivo:         string   // nombre del archivo .md
  directorios:     string[] // en qué dirs aparece
  therapyProfiles: string[] // union de tags (sin duplicados)
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function chunkText(text: string, docName: string) {
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const chunks: Array<{ content: string; chunkIndex: number; docName: string }> = []
  let i = 0
  let chunkIndex = 0

  while (i < words.length) {
    const content = words.slice(i, i + CHUNK_SIZE).join(' ')
    if (content.trim().length > 50) {
      chunks.push({ content, chunkIndex, docName })
      chunkIndex++
    }
    i += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  })
  return response.data.map(d => d.embedding)
}

function mergeProfiles(profiles: string[][]): string[] {
  const set = new Set<string>()
  for (const arr of profiles) {
    for (const p of arr) set.add(p)
  }
  return Array.from(set).sort()
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Escaneando directorios docs-*/...\n')

  const rootDir = process.cwd()

  // 1. Recopilar todos los archivos por directorio y mergear tags de duplicados
  const docsMap = new Map<string, DocEntry>()

  for (const [dirName, profiles] of Object.entries(DIR_PROFILE_MAP)) {
    const dirPath = path.join(rootDir, dirName)
    if (!fs.existsSync(dirPath)) {
      console.warn(`  ⚠️  Directorio no encontrado: ${dirName}`)
      continue
    }

    const archivos = fs.readdirSync(dirPath).filter(f => f.endsWith('.md')).sort()
    console.log(`📁 ${dirName}: ${archivos.length} archivos`)

    for (const archivo of archivos) {
      const existing = docsMap.get(archivo)
      if (existing) {
        // Archivo duplicado en otro directorio → mergear tags
        existing.directorios.push(dirName)
        existing.therapyProfiles = mergeProfiles([existing.therapyProfiles, profiles])
        console.log(`   ↩️  ${archivo} — duplicado, tags mergeados: [${existing.therapyProfiles.join(', ')}]`)
      } else {
        docsMap.set(archivo, {
          archivo,
          directorios: [dirName],
          therapyProfiles: profiles,
        })
        console.log(`   📄 ${archivo} — [${profiles.join(', ')}]`)
      }
    }
  }

  console.log(`\n📊 Total documentos únicos: ${docsMap.size}`)

  // 2. Borrar chunks anteriores
  const { error: deleteError } = await supabase
    .from('document_chunks')
    .delete()
    .neq('id', 0)

  if (deleteError) {
    console.error('❌ Error al limpiar chunks anteriores:', deleteError.message)
    process.exit(1)
  }
  console.log('🗑  Chunks anteriores eliminados\n')

  // 3. Indexar cada documento único
  let totalChunks = 0

  for (const [archivo, entry] of docsMap.entries()) {
    const docName = archivo.replace('.md', '').replace(/_/g, ' ')

    // Leer el archivo desde el PRIMER directorio donde aparece
    const firstDir = entry.directorios[0]
    const filePath = path.join(rootDir, firstDir, archivo)
    const texto = fs.readFileSync(filePath, 'utf-8')

    const chunks = chunkText(texto, docName)
    const profileLabel = `[${entry.therapyProfiles.join(', ')}]`
    console.log(`📄 ${docName}: ${chunks.length} chunks  ${profileLabel}`)

    for (let b = 0; b < chunks.length; b += BATCH_SIZE) {
      const batch = chunks.slice(b, b + BATCH_SIZE)
      const texts = batch.map(c => `[${c.docName}]\n\n${c.content}`)
      const embeddings = await generateEmbeddings(texts)

      const rows = batch.map((chunk, idx) => ({
        doc_name:         chunk.docName,
        chunk_index:      chunk.chunkIndex,
        content:          chunk.content,
        embedding:        embeddings[idx],
        therapy_profiles: entry.therapyProfiles,
        metadata:         { archivo, directorios: entry.directorios },
      }))

      const { error } = await supabase.from('document_chunks').insert(rows)
      if (error) {
        console.error(`  ❌ Error insertando batch: ${error.message}`)
        process.exit(1)
      }

      process.stdout.write(`  ✓ ${Math.min(b + BATCH_SIZE, chunks.length)}/${chunks.length} chunks\r`)

      if (b + BATCH_SIZE < chunks.length) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    console.log(`  ✅ ${chunks.length} chunks indexados           `)
    totalChunks += chunks.length
  }

  // 4. Resumen final
  console.log(`\n🎉 Re-indexación Multi-RAG completada.`)
  console.log(`   Documentos únicos: ${docsMap.size}`)
  console.log(`   Total chunks en DB: ${totalChunks}`)
  console.log(`   Costo estimado embeddings: $${(totalChunks * 400 / 1_000_000 * 0.02).toFixed(4)}`)

  console.log('\n📊 Desglose por perfil:')
  const perfilConteo: Record<string, number> = {}
  for (const entry of docsMap.values()) {
    for (const p of entry.therapyProfiles) {
      perfilConteo[p] = (perfilConteo[p] ?? 0) + 1
    }
  }
  for (const [perfil, count] of Object.entries(perfilConteo).sort()) {
    console.log(`   ${perfil}: ${count} documentos fuente`)
  }
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message ?? err)
  process.exit(1)
})
