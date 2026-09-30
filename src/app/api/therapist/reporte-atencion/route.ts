// ─────────────────────────────────────────────────────────────
// POST /api/therapist/reporte-atencion
// Genera el contenido de las secciones 6, 7 y 8 del Reporte de la Atención
// usando una única llamada a Claude con todas las sesiones del paciente(s)
// Sprint 10 (Cambio XII) — E6
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const therapistId = user.id
  const admin       = createAdminClient()

  const body = await req.json()
  const {
    patient_id,       // string | 'all'
    date_from,        // 'YYYY-MM-DD'
    date_to,          // 'YYYY-MM-DD'
    patient_status,   // 'activos' | 'inactivos'
  } = body as {
    patient_id: string
    date_from: string
    date_to: string
    patient_status: 'activos' | 'inactivos'
  }

  // ── 1. Resolver lista de patient IDs ────────────────────────────────────────
  let patientIds: string[] = []

  if (patient_id !== 'all') {
    patientIds = [patient_id]
  } else {
    let q = admin
      .from('therapist_patients')
      .select('patient_id')
      .eq('therapist_id', therapistId)
      .neq('status', 'archived')

    if (patient_status === 'activos')   q = q.eq('is_active', true)
    if (patient_status === 'inactivos') q = q.eq('is_active', false)

    const { data } = await q
    patientIds = (data ?? []).map(r => r.patient_id as string)
  }

  if (patientIds.length === 0) {
    return NextResponse.json({ s6: '', s7: '', s8: '', pacientes: [] })
  }

  // ── 2. Obtener sesiones presenciales en el rango ────────────────────────────
  const { data: sesiones } = await admin
    .from('therapist_session_notes')
    .select('patient_id, session_number, session_date, session_objetivo, session_desarrollo, notes')
    .eq('therapist_id', therapistId)
    .in('patient_id', patientIds)
    .gte('session_date', date_from)
    .lte('session_date', date_to)
    .order('session_date', { ascending: true })

  // ── 3. Obtener datos básicos de cada paciente ───────────────────────────────
  const { data: relaciones } = await admin
    .from('therapist_patients')
    .select('patient_id, initial_note_motivo, initial_note_subyacente')
    .eq('therapist_id', therapistId)
    .in('patient_id', patientIds)

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name')
    .in('id', patientIds)

  const nombrePorId: Record<string, string> = {}
  for (const p of profiles ?? []) {
    nombrePorId[p.id] = p.full_name ?? p.id
  }

  const motivoPorId: Record<string, string> = {}
  for (const r of relaciones ?? []) {
    motivoPorId[r.patient_id as string] = (r.initial_note_motivo as string) ?? ''
  }

  // ── 4. Construir contexto para Claude ───────────────────────────────────────
  const sesionesPorPaciente: Record<string, typeof sesiones> = {}
  for (const s of sesiones ?? []) {
    const pid = s.patient_id as string
    if (!sesionesPorPaciente[pid]) sesionesPorPaciente[pid] = []
    sesionesPorPaciente[pid]!.push(s)
  }

  const contexto = patientIds.map(pid => {
    const nombre = nombrePorId[pid] ?? 'Paciente'
    const motivo = motivoPorId[pid] ?? 'No especificado'
    const seses  = sesionesPorPaciente[pid] ?? []
    const sesText = seses.map(s =>
      `Sesión ${s.session_number ?? '?'} (${s.session_date}):
      - Objetivo: ${s.session_objetivo ?? 'No registrado'}
      - Desarrollo: ${s.session_desarrollo ?? 'No registrado'}
      - Observaciones: ${s.notes ?? 'Ninguna'}`
    ).join('\n\n')
    return `=== PACIENTE: ${nombre} ===
Motivo de consulta: ${motivo}
Sesiones (${seses.length}):
${sesText || 'Sin sesiones en el periodo.'}`
  }).join('\n\n---\n\n')

  // ── 5. Llamada única a Claude ────────────────────────────────────────────────
  const prompt = `Eres un asistente clínico experto. Analiza las siguientes sesiones terapéuticas y redacta tres secciones para un reporte de atención profesional.

${contexto}

Responde EXCLUSIVAMENTE en este formato JSON (sin texto adicional):
{
  "s6": "RESUMEN DE SESIONES: Párrafo(s) que sintetizan el desarrollo general del proceso terapéutico, los temas abordados y los avances observados por paciente (o integrado si son varios).",
  "s7": "ANÁLISIS DEL PROCESO: Análisis clínico de la evolución, patrones identificados, recursos del paciente y áreas de trabajo.",
  "s8": "CONCLUSIONES Y RECOMENDACIONES: Conclusiones del proceso hasta la fecha y recomendaciones para continuar o cerrar el proceso terapéutico."
}`

  let s6 = '', s7 = '', s8 = ''
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = resp.content[0].type === 'text' ? resp.content[0].text : ''
    const parsed = JSON.parse(text)
    s6 = parsed.s6 ?? ''
    s7 = parsed.s7 ?? ''
    s8 = parsed.s8 ?? ''
  } catch {
    s6 = 'Error al generar el resumen de sesiones. Intenta de nuevo.'
    s7 = 'Error al generar el análisis del proceso.'
    s8 = 'Error al generar las conclusiones.'
  }

  // ── 6. Respuesta ─────────────────────────────────────────────────────────────
  const pacientes = patientIds.map(pid => ({
    id:     pid,
    nombre: nombrePorId[pid] ?? 'Paciente',
    motivo: motivoPorId[pid] ?? '',
    total_sesiones: (sesionesPorPaciente[pid] ?? []).length,
    fechas: (sesionesPorPaciente[pid] ?? []).map(s => s.session_date as string),
  }))

  return NextResponse.json({ s6, s7, s8, pacientes })
}
