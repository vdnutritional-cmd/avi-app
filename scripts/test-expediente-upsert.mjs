/**
 * test-expediente-upsert.mjs — Diagnóstico local
 * Prueba el upsert a patient_expediente con los mismos campos que
 * usa /registro-consultorio y muestra el error exacto.
 *
 * Uso:
 *   cd ~/Documents/Obsidian\ Vault/avi-app
 *   node scripts/test-expediente-upsert.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Leer .env.local ────────────────────────────────────────────────────────
const envPath = join(__dirname, '..', '.env.local')
const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const idx = t.indexOf('=')
  if (idx < 0) continue
  env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY']

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
})

async function main() {
  // 1. Obtener un patient_id real para evitar FK violations
  const { data: links, error: linksErr } = await admin
    .from('therapist_patients')
    .select('therapist_id, patient_id')
    .limit(3)

  if (linksErr || !links?.length) {
    console.error('❌ No se encontraron vínculos therapist_patients:', linksErr?.message)
    process.exit(1)
  }

  console.log(`\n✅ Usando ${links.length} vínculo(s) para probar:\n`)

  for (const link of links) {
    const { therapist_id, patient_id } = link
    console.log(`  therapist: ${therapist_id}`)
    console.log(`  patient:   ${patient_id}`)

    // 2. Probar el upsert
    const { data, error } = await admin
      .from('patient_expediente')
      .upsert({
        patient_id,
        therapist_id,
        asesorado_nombre:           'TEST-LOCAL',
        asesorado_sexo:             'M',
        asesorado_edad:             '30',
        asesorado_fecha_nacimiento: '',
        asesorado_lugar_nacimiento: '',
        asesorado_estado_civil:     '',
        asesorado_escolaridad:      '',
        asesorado_ocupacion:        '',
        asesorado_religion:         '',
        asesorado_parroquia:        '',
        contacto_telefono:          '',
        contacto_domicilio:         '',
        pareja_nombre:              '',
        pareja_sexo:                '',
        pareja_edad:                '',
        pareja_fecha_nacimiento:    '',
        hijos:                      [],
        salud_padece_enfermedad:    '',
        salud_ayuda_psicologica:    '',
        salud_ayuda_tiempo:         '',
        salud_medicamentos:         '',
        salud_medicamentos_cual:    '',
      }, { onConflict: 'therapist_id,patient_id' })
      .select('patient_id, asesorado_nombre')

    if (error) {
      console.log(`  ❌ UPSERT FALLÓ:`)
      console.log(`     message: ${error.message}`)
      console.log(`     code:    ${error.code}`)
      console.log(`     details: ${error.details}`)
      console.log(`     hint:    ${error.hint}`)
    } else {
      console.log(`  ✅ Upsert exitoso:`, data)
    }

    // 3. Ver columnas de la tabla (SELECT * LIMIT 1)
    const { data: sample } = await admin
      .from('patient_expediente')
      .select('*')
      .eq('therapist_id', therapist_id)
      .eq('patient_id', patient_id)
      .maybeSingle()

    if (sample) {
      const cols = Object.keys(sample)
      const hasNew = cols.filter(c => c.startsWith('asesorado_') || c.startsWith('contacto_') || c.startsWith('salud_') || c === 'hijos')
      console.log(`\n  Columnas nuevas presentes en tabla (${hasNew.length}):`, hasNew)
      console.log(`  Total columnas en tabla: ${cols.length}`)
    } else {
      console.log(`  (sin fila existente — no se puede leer columnas)`)
    }

    console.log('')
  }
}

main().catch(err => {
  console.error('\n💥 Error inesperado:', err.message)
  process.exit(1)
})
