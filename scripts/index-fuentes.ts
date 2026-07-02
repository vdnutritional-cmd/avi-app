/**
 * AVI — Script de indexación RAG para ConsultoriaFuentes
 * Usa OpenAI text-embedding-3-small (1536 dimensiones)
 *
 * Ejecutar UNA SOLA VEZ (o cuando se actualicen los docs):
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

const CHUNK_SIZE = 400      // palabras por chunk
const CHUNK_OVERLAP = 50    // palabras de overlap entre chunks
const BATCH_SIZE = 20       // embeddings en paralelo por batch

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

async function main() {
  console.log('🔍 Leyendo fuentes de docs/...')

  const docsDir = path.join(process.cwd(), 'docs')
  const archivos = fs.readdirSync(docsDir).filter(f => f.endsWith('.md')).sort()
  console.log(`   ${archivos.length} documentos encontrados`)

  const { error: deleteError } = await supabase.from('document_chunks').delete().neq('id', 0)
  if (deleteError) {
    console.error('❌ Error al limpiar chunks anteriores:', deleteError.message)
    process.exit(1)
  }
  console.log('🗑  Chunks anteriores eliminados\n')

  let totalChunks = 0

  for (const archivo of archivos) {
    const docName = archivo.replace('.md', '').replace(/_/g, ' ')
    const texto = fs.readFileSync(path.join(docsDir, archivo), 'utf-8')
    const chunks = chunkText(texto, docName)
    console.log(`📄 ${docName}: ${chunks.length} chunks`)

    for (let b = 0; b < chunks.length; b += BATCH_SIZE) {
      const batch = chunks.slice(b, b + BATCH_SIZE)
      const texts = batch.map(c => `[${c.docName}]\n\n${c.content}`)
      const embeddings = await generateEmbeddings(texts)

      const rows = batch.map((chunk, idx) => ({
        doc_name: chunk.docName,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        embedding: embeddings[idx],
        metadata: { archivo },
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

  console.log(`\n🎉 Listo. Total: ${totalChunks} chunks indexados en Supabase.`)
  console.log('   Costo estimado: $' + (totalChunks * 400 / 1_000_000 * 0.02).toFixed(4))
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message ?? err)
  process.exit(1)
})
