// ─────────────────────────────────────────────────────────────
// POST /api/therapist/reporte-atencion
// Genera los datos de las 9 secciones del Reporte de la Atención.
// Sprint 10 (Cambio XII) — E6 — reescritura completa
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import {
  resolveFactores,
  SCHEMA_LABELS,
  SCHEMA_RIESGO_COL,
  SCHEMA_PROTECCION_COL,
} from '@/app/therapist/patients/[patientId]/factores-nota-inicial'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const therapistId = user.id
  const admin       = createAdminClient()

  const body = await req.json()
  const { patient_id, date_from, date_to } = body as {
    patient_id: string
    date_from:  string
    date_to:    string
  }

  if (!patient_id || !date_from || !date_to) {
    return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 })
  }

  // ── 1. Fetch en paralelo ────────────────────────────────────────────────────
  const [
    { data: perfil },
    { data: expediente },
    { data: relacion },
    { data: sesiones },
    { data: derivacion },
    { data: pacienteProfile },
    { data: terapeutaProfile },
  ] = await Promise.all([
    // Perfil del paciente
    admin.from('profiles').select('full_name').eq('id', patient_id).single(),
    // Expediente: tipo de caso + problemática
    admin
      .from('patient_expediente')
      .select('tipo_caso, problematica')
      .eq('therapist_id', therapistId)
      .eq('patient_id', patient_id)
      .maybeSingle(),
    // Relación terapeuta-paciente: motivos + sensación + factores
    admin
      .from('therapist_patients')
      .select(`
        initial_note_motivo, initial_note_subyacente,
        sensacion_paciente_inicial, frecuencia_config,
        factores_riesgo_sel, factores_proteccion_sel,
        factores_riesgo_trec, factores_proteccion_trec,
        factores_riesgo_tcc, factores_proteccion_tcc
      `)
      .eq('therapist_id', therapistId)
      .eq('patient_id', patient_id)
      .single(),
    // Sesiones presenciales en el rango de fechas
    admin
      .from('therapist_session_notes')
      .select('id, session_number, session_date, session_objetivo, session_emociones, session_recursos, session_desarrollo, notes')
      .eq('therapist_id', therapistId)
      .eq('patient_id', patient_id)
      .gte('session_date', date_from)
      .lte('session_date', date_to)
      .order('session_date', { ascending: true }),
    // Derivaciones y cierres
    admin
      .from('patient_derivaciones_cierres')
      .select('derivacion_tipos, atencion_especializada, atencion_especializada_cual')
      .eq('therapist_id', therapistId)
      .eq('patient_id', patient_id)
      .maybeSingle(),
    // Nombre del paciente (redundante pero por si acaso)
    admin.from('profiles').select('full_name').eq('id', patient_id).single(),
    // Nombre del terapeuta
    admin.from('profiles').select('full_name').eq('id', therapistId).single(),
  ])

  const pacienteNombre  = perfil?.full_name ?? 'Paciente'
  const terapeutaNombre = terapeutaProfile?.full_name ?? '—'

  // ── 2. Sección 1: Motivo de consulta ────────────────────────────────────────
  const tipoCaso        = (expediente?.tipo_caso    as string) ?? ''
  const problematica    = (expediente?.problematica as string) ?? ''
  const motivoSubyacente = (relacion?.initial_note_subyacente as string) ?? ''
  const motivoConsulta  = (relacion?.initial_note_motivo      as string) ?? ''

  // ── 3. Secciones 3+4: Emociones y Recursos por fecha ───────────────────────
  const fmtDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const emociones = (sesiones ?? [])
    .filter(s => (s.session_emociones as string | null)?.trim())
    .map(s => ({ fecha: fmtDate(s.session_date as string), texto: (s.session_emociones as string).trim() }))

  const recursos = (sesiones ?? [])
    .filter(s => (s.session_recursos as string | null)?.trim())
    .map(s => ({ fecha: fmtDate(s.session_date as string), texto: (s.session_recursos as string).trim() }))

  // ── 4. Sección 5: Factores de riesgo y protección ──────────────────────────
  const tipoCasoLow = tipoCaso.toLowerCase()
  const caseType: 'individual' | 'familiar' | 'pareja' =
    tipoCasoLow.includes('pareja') ? 'pareja' :
    tipoCasoLow.includes('famil')  ? 'familiar' : 'individual'

  interface FactorGrupo { esquema: string; items: string[] }

  function buildFactorGrupos(tipo: 'riesgo' | 'proteccion'): FactorGrupo[] {
    const colMap = tipo === 'riesgo' ? SCHEMA_RIESGO_COL : SCHEMA_PROTECCION_COL
    const grupos: FactorGrupo[] = []
    for (const schema of ['famsis', 'trec', 'cc'] as const) {
      const col   = colMap[schema]
      const keys: string[] = (relacion as Record<string, unknown> | null)?.[col] as string[] ?? []
      if (!keys?.length) continue
      const items = resolveFactores(schema, caseType, tipo, keys)
      if (!items.length) continue
      grupos.push({ esquema: SCHEMA_LABELS[schema], items: items.map(f => f.titulo) })
    }
    return grupos
  }

  const factoresRiesgo     = buildFactorGrupos('riesgo')
  const factoresProteccion = buildFactorGrupos('proteccion')

  // ── 5. Secciones 6, 7, 8: Resúmenes por sesión con Claude ──────────────────
  interface SesionResumen {
    fecha:        string
    numero:       number
    intervencion: string
    acuerdo:      string
    seguimiento:  string
  }

  let sesionesResumenes: SesionResumen[] = []

  const sesionesFiltradas = sesiones ?? []

  if (sesionesFiltradas.length > 0) {
    const contexto = sesionesFiltradas.map(s =>
      `SESIÓN ${s.session_number} (${s.session_date}):
- Objetivo/Seguimiento: ${(s.session_objetivo as string | null) ?? 'No registrado'}
- Desarrollo/Intervención: ${(s.session_desarrollo as string | null) ?? 'No registrado'}
- Observaciones/Acuerdos/Tareas: ${(s.notes as string | null) ?? 'Ninguna'}`
    ).join('\n\n')

    const prompt = `Eres un asistente clínico. Para cada sesión terapéutica, genera un resumen BREVE (máximo 2 oraciones) de: la intervención realizada, los acuerdos/tareas pactadas, y el objetivo/seguimiento planteado.

SESIONES:
${contexto}

Responde EXCLUSIVAMENTE con JSON válido, sin texto adicional antes ni después:
{
  "resumenes": [
    {
      "numero": <número de sesión>,
      "fecha": "<YYYY-MM-DD>",
      "intervencion": "<resumen muy breve del Desarrollo/Intervención>",
      "acuerdo": "<resumen breve de Observaciones/Acuerdos/Tareas>",
      "seguimiento": "<resumen breve del Objetivo/Seguimiento>"
    }
  ]
}`

    try {
      const resp = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages:   [{ role: 'user', content: prompt }],
      })
      const raw  = resp.content[0].type === 'text' ? resp.content[0].text : ''
      // Extraer JSON de forma robusta (Claude puede incluir backticks)
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        sesionesResumenes = (parsed.resumenes ?? []).map((r: Record<string, unknown>) => ({
          numero:       r.numero as number,
          fecha:        fmtDate(r.fecha as string),
          intervencion: (r.intervencion as string) ?? '',
          acuerdo:      (r.acuerdo     as string) ?? '',
          seguimiento:  (r.seguimiento as string) ?? '',
        }))
      }
    } catch {
      // Si Claude falla, generar datos vacíos por sesión (no error fatal)
      sesionesResumenes = sesionesFiltradas.map(s => ({
        numero:       s.session_number  as number,
        fecha:        fmtDate(s.session_date as string),
        intervencion: '',
        acuerdo:      '',
        seguimiento:  '',
      }))
    }
  }

  // ── 6. Sección 9: Derivación ────────────────────────────────────────────────
  const derivacionTipos: string[] = (derivacion?.derivacion_tipos as string[]) ?? []
  const atencionEsp     = (derivacion?.atencion_especializada      as string) ?? 'n/a'
  const atencionEspCual = (derivacion?.atencion_especializada_cual as string) ?? ''

  // ── 7. Respuesta ────────────────────────────────────────────────────────────
  return NextResponse.json({
    paciente_nombre:       pacienteNombre,
    terapeuta_nombre:      terapeutaNombre,
    tipo_caso:             tipoCaso,
    problematica,
    motivo_subyacente:     motivoSubyacente,
    motivo_consulta:       motivoConsulta,
    emociones,
    recursos,
    factores_riesgo:       factoresRiesgo,
    factores_proteccion:   factoresProteccion,
    sesiones_resumenes:    sesionesResumenes,
    derivacion_tipos:      derivacionTipos,
    atencion_especializada:      atencionEsp,
    atencion_especializada_cual: atencionEspCual,
    total_sesiones:        sesionesFiltradas.length,
  })
}
