/**
 * check-backups.mjs — Diagnóstico temporal
 * Verifica si existen filas de patient_expediente en los backups de Supabase Storage.
 *
 * Uso:
 *   cd /ruta/al/proyecto
 *   node scripts/check-backups.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { gunzipSync } from 'zlib'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Leer .env.local ────────────────────────────────────────────────────────
const envPath = join(__dirname, '..', '.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const idx = trimmed.indexOf('=')
  if (idx < 0) continue
  const k = trimmed.slice(0, idx).trim()
  const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
  env[k] = v
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  No se encontraron NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
})

// ── IDs a buscar ───────────────────────────────────────────────────────────
const PATIENT_IDS = {
  daniel:  '305489c8-b66c-4735-bf82-c728f2b7e0c5',
  enrique: null,  // agregar si se conoce
  maripaz: null,  // agregar si se conoce
}

async function main() {
  console.log('🔍  Listando archivos en bucket "backups"...\n')

  const { data: files, error: listErr } = await admin.storage
    .from('backups')
    .list('', { limit: 50, sortBy: { column: 'name', order: 'desc' } })

  if (listErr) {
    console.error('❌  Error al listar backups:', listErr.message)
    process.exit(1)
  }

  if (!files || files.length === 0) {
    console.log('⚠️   No se encontraron archivos en el bucket "backups".')
    process.exit(0)
  }

  console.log(`📦  ${files.length} archivo(s) encontrado(s):`)
  files.forEach(f => console.log(`    ${f.name}`))

  // ── Filtrar backups de Sep 14-17 (lunes a hoy) ─────────────────────────
  const TARGET_DATES = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']
  const targets = files.filter(f => TARGET_DATES.some(d => f.name.includes(d)))

  if (targets.length === 0) {
    console.log('\n⚠️   No se encontraron backups para Sep 14-17. Revisando el backup más reciente...')
    targets.push(files[0])
  } else {
    console.log(`\n🎯  Backups relevantes (Sep 14-17):`)
    targets.forEach(f => console.log(`    ${f.name}`))
  }

  // ── Descargar y analizar cada backup relevante ─────────────────────────
  for (const file of targets) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`📥  Descargando: ${file.name} ...`)

    const { data: blob, error: dlErr } = await admin.storage
      .from('backups')
      .download(file.name)

    if (dlErr) {
      console.error(`❌  Error al descargar ${file.name}:`, dlErr.message)
      continue
    }

    const buffer = Buffer.from(await blob.arrayBuffer())
    console.log(`    Tamaño comprimido: ${(buffer.length / 1024).toFixed(1)} KB`)

    let sql
    try {
      const decompressed = gunzipSync(buffer)
      sql = decompressed.toString('utf8')
      console.log(`    Tamaño descomprimido: ${(sql.length / 1024).toFixed(1)} KB`)
    } catch (e) {
      console.error('❌  No se pudo descomprimir (¿no es gzip?):', e.message)
      continue
    }

    // ── Buscar sección COPY de patient_expediente ────────────────────────
    const lines = sql.split('\n')
    let inExpedienteCopy = false
    let expedienteRows = []
    let expedienteHeaderLine = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('COPY public.patient_expediente') || line.startsWith('COPY patient_expediente')) {
        inExpedienteCopy = true
        expedienteHeaderLine = line
        continue
      }

      if (inExpedienteCopy) {
        if (line === '\\.') { inExpedienteCopy = false; break }
        expedienteRows.push(line)
      }
    }

    console.log(`\n  patient_expediente: ${expedienteRows.length} fila(s) en este backup`)

    if (expedienteRows.length === 0) {
      console.log('  ⚠️   La tabla estaba VACÍA en este backup.')
    } else {
      console.log(`  Header: ${expedienteHeaderLine.substring(0, 120)}`)
      console.log(`  Filas encontradas:`)
      expedienteRows.forEach((row, idx) => {
        // Truncar filas largas para lectura
        console.log(`  [${idx + 1}] ${row.substring(0, 200)}${row.length > 200 ? '...' : ''}`)
      })

      // ── Buscar patient_ids específicos ─────────────────────────────────
      console.log('\n  🔎  Buscando IDs de pacientes específicos:')
      for (const [name, pid] of Object.entries(PATIENT_IDS)) {
        if (!pid) continue
        const found = expedienteRows.some(r => r.includes(pid))
        console.log(`    ${name} (${pid}): ${found ? '✅ ENCONTRADO' : '❌ NO encontrado'}`)
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('✅  Diagnóstico completado.')
}

main().catch(err => {
  console.error('\n💥  Error inesperado:', err)
  process.exit(1)
})
