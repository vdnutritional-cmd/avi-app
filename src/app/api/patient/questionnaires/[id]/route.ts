import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  calcularResultadoFAD,
  FAD_DIMENSION_LABELS,
  FAD_DIMENSION_ORDER,
} from '@/lib/questionnaires/mcmaster-fad'

/**
 * PATCH /api/patient/questionnaires/[id]
 * El paciente envía sus respuestas. Calcula puntajes y guarda en Supabase.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Verificar que el cuestionario pertenece al paciente y está pendiente
  const { data: quest, error: fetchErr } = await supabase
    .from('patient_questionnaires')
    .select('id, questionnaire_type, patient_id, status')
    .eq('id', id)
    .eq('patient_id', user.id)
    .single()

  if (fetchErr || !quest) {
    return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })
  }
  if (quest.status !== 'pending') {
    return NextResponse.json({ error: 'El cuestionario ya fue completado' }, { status: 409 })
  }

  const { responses } = await req.json()
  if (!responses || typeof responses !== 'object') {
    return NextResponse.json({ error: 'Respuestas inválidas' }, { status: 400 })
  }

  let score: object = {}
  let interpretation = ''

  // ── sensacion_final: respuesta numérica 1-10 ─────────────────────────────
  if (quest.questionnaire_type === 'sensacion_final') {
    const valor = responses['sensacion'] // número 1-10
    if (typeof valor !== 'number' || valor < 1 || valor > 10) {
      return NextResponse.json({ error: 'Valor de sensación inválido (debe ser 1-10)' }, { status: 400 })
    }

    // Guardar cuestionario como completado
    const { error: updateErr } = await supabase
      .from('patient_questionnaires')
      .update({
        responses,
        score: { sensacion: valor },
        interpretation: `Sensación final del paciente: ${valor}/10`,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('patient_id', user.id)

    if (updateErr) {
      console.error('[questionnaire/sensacion_final] Error al guardar cuestionario:', updateErr)
      return NextResponse.json({ error: 'Error al guardar las respuestas' }, { status: 500 })
    }

    // Obtener therapist_id del cuestionario para el upsert
    const { data: questFull } = await supabase
      .from('patient_questionnaires')
      .select('therapist_id')
      .eq('id', id)
      .single()

    if (questFull?.therapist_id) {
      const { error: dcErr } = await supabase
        .from('patient_derivaciones_cierres')
        .upsert(
          {
            therapist_id:             questFull.therapist_id,
            patient_id:               user.id,
            sensacion_paciente_final: String(valor),
          },
          { onConflict: 'therapist_id,patient_id' }
        )

      if (dcErr) {
        console.error('[questionnaire/sensacion_final] Error al actualizar derivaciones_cierres:', dcErr)
      }
    }

    return NextResponse.json({ ok: true, score: { sensacion: valor } })
  }

  if (quest.questionnaire_type === 'mcmaster_fad') {
    const resultado = calcularResultadoFAD(responses)
    score = resultado

    // Construir reporte textual (tabla 4 columnas × 8 renglones)
    const sep  = '─'.repeat(70)
    const lines: string[] = []

    lines.push('FAD McMaster — Evaluación de Funcionalidad Familiar')
    lines.push(sep)
    lines.push(
      'Dimensión'.padEnd(32) +
      'VD'.padStart(5) +
      '%Funcional'.padStart(12) +
      '%Disfuncional'.padStart(15)
    )
    lines.push(sep)

    for (const dim of FAD_DIMENSION_ORDER) {
      const d = resultado.dimensions[dim]
      const label = FAD_DIMENSION_LABELS[dim]
      lines.push(
        label.padEnd(32) +
        String(d.VD).padStart(5) +
        `${d.pctFD}%`.padStart(12) +
        `${d.pctDD}%`.padStart(15)
      )
    }

    lines.push(sep)
    lines.push(
      'Resultado por Evaluación Funcional'.padEnd(32) +
      ''.padStart(5) +
      `${resultado.global.pctREF}%`.padStart(12) +
      `${resultado.global.pctRED}%`.padStart(15)
    )

    const valorMax = Math.max(resultado.global.pctREF, resultado.global.pctRED)
    const etiqueta = resultado.global.evaluacion
    lines.push(sep)
    lines.push(
      'Evaluación de la Funcionalidad Familiar'.padEnd(32) +
      `${valorMax}% — ${etiqueta}`.padStart(32)
    )
    lines.push(sep)

    interpretation = lines.join('\n')
  }

  // Guardar en Supabase
  const { error: updateErr } = await supabase
    .from('patient_questionnaires')
    .update({
      responses,
      score,
      interpretation,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('patient_id', user.id)

  if (updateErr) {
    console.error('[questionnaire] Error al guardar:', updateErr)
    return NextResponse.json({ error: 'Error al guardar las respuestas' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, score })
}
