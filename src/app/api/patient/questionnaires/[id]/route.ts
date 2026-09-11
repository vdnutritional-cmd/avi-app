import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcularPuntajesFAD, FAD_CUTOFFS, FAD_DIMENSION_LABELS } from '@/lib/questionnaires/mcmaster-fad'

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

  // Calcular puntajes según el tipo
  let score: Record<string, number> = {}
  let interpretation = ''

  if (quest.questionnaire_type === 'mcmaster_fad') {
    score = calcularPuntajesFAD(responses)

    // Construir interpretación textual
    const lineas: string[] = []
    for (const [dim, val] of Object.entries(score)) {
      const corte = FAD_CUTOFFS[dim as keyof typeof FAD_CUTOFFS]
      const label = FAD_DIMENSION_LABELS[dim as keyof typeof FAD_DIMENSION_LABELS]
      const estado = val >= corte ? '⚠️ Disfunción' : '✓ Saludable'
      lineas.push(`${label}: ${val} (${estado}, corte ≥${corte})`)
    }
    interpretation = lineas.join('\n')
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
