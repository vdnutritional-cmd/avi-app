import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

// Auto-análisis ligero: sin ConsultoriaFuentes — solo nota inicial + patrones acumulados.
// El análisis completo con fuentes se genera bajo demanda desde Consúltame.
async function triggerAutoAnalysis(patientId: string, supabase: SupabaseClient) {
  const { data: relation } = await supabase
    .from('therapist_patients')
    .select('therapist_id, initial_note')
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .single()

  if (!relation?.initial_note?.trim()) return

  const { data: allPatterns } = await supabase
    .from('patterns')
    .select('summary, predominant_emotions, emotional_patterns, reformulation, crisis_detected, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true })

  if (!allPatterns || allPatterns.length === 0) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', patientId)
    .single()

  const nombrePaciente = profile?.full_name ?? 'el consultante'

  const sesiones = allPatterns.map((p, i) => [
    `--- Sesión ${i + 1} (${new Date(p.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}) ---`,
    `Resumen: ${p.summary}`,
    `Emociones: ${(p.predominant_emotions ?? []).join(', ')}`,
    `Patrones: ${(p.emotional_patterns ?? []).join(', ')}`,
    `Reformulación: "${p.reformulation ?? ''}"`,
    p.crisis_detected ? '⚠️ Alerta de crisis detectada.' : '',
  ].filter(Boolean).join('\n')).join('\n\n')

  const prompt = `Eres supervisor clínico. Genera un seguimiento breve y actualizado del caso para el terapeuta. Sin relleno — solo lo que importa.

NOTA INICIAL:
${relation.initial_note}

SESIONES AVI (cronológico):
${sesiones}

Responde en este formato exacto:

**EVOLUCIÓN**
¿Avance, estancamiento o retroceso desde la nota inicial? Una o dos oraciones concretas.

**ESTADO ACTUAL**
Dónde está ${nombrePaciente} emocionalmente hoy. Breve y directo.

**PUNTO DE ATENCIÓN**
Lo más relevante que el terapeuta debe tener en mente en la próxima sesión.

Todo en español. Sin introducción ni cierre formal.`

  const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const response = await anthropicClient.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0].type === 'text' ? response.content[0].text : ''
  if (!content) return

  await supabase.from('analyses').insert({
    therapist_id: relation.therapist_id,
    patient_id: patientId,
    content,
    title: 'Actualización automática',
    sessions_analyzed: [],
    techniques_proposed: [],
    session_plan: [],
  })
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const PatternSchema = z.object({
  summary: z.string(),
  emotional_patterns: z.array(z.string()),
  predominant_emotions: z.array(z.string()),
  reformulation: z.string(),
  crisis_detected: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { sessionId } = await request.json()
    if (!sessionId) return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })

    // Verificar que la sesión pertenece al usuario
    const { data: session } = await supabase
      .from('sessions')
      .select('id, patient_id, status')
      .eq('id', sessionId)
      .eq('patient_id', user.id)
      .single()

    if (!session) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Esta sesión ya fue procesada' }, { status: 400 })
    }

    // Obtener todos los mensajes de la sesión
    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (!messages || messages.length < 2) {
      return NextResponse.json({ error: 'La sesión tiene muy pocos mensajes para analizar' }, { status: 400 })
    }

    // Construir transcripción para Claude
    const transcript = messages
      .map(m => `${m.role === 'user' ? 'PERSONA' : 'AVI'}: ${m.content}`)
      .join('\n\n')

    const analysisPrompt = `Eres un analista clínico del marco ConsultoriaFuentes. Analiza la siguiente sesión de acompañamiento emocional y genera un resumen estructurado en JSON.

MARCO TEÓRICO — usa este vocabulario cuando aplique al caso:
- Heridas emocionales: abandono, rechazo, humillación, traición, injusticia
- Apego (Bowlby/Ainsworth): seguro, ansioso, evitativo, desorganizado
- Comunicación disfuncional (Satir): aplacar, culpar, intelectualizar, distraer, incongruente
- Patrones relacionales (Gottman): crítica, desprecio, actitud defensiva, stonewalling
- Dinámicas sistémicas (Minuchin): límites difusos, triangulación, coalición, jerarquía invertida
- Origen del síntoma (Gabor Maté): trauma no procesado, desconexión mente-cuerpo, necesidad insatisfecha
- Personalismo (Wojtyla/Burgos): persona usada como medio, pérdida de autodeterminación, vínculo fracturado

TRANSCRIPCIÓN:
${transcript}

Genera un objeto JSON con exactamente esta estructura (sin texto adicional, solo el JSON):
{
  "summary": "Resumen breve de 2-3 oraciones de qué expresó la persona y cómo se sintió durante la sesión",
  "emotional_patterns": ["patrón 1", "patrón 2", "patrón 3"],
  "predominant_emotions": ["emoción 1", "emoción 2"],
  "reformulation": "Una frase breve y esperanzadora desde la dignidad personal y la capacidad de sanar",
  "crisis_detected": false
}

Instrucciones:
- summary: objetivo, en tercera persona ("La persona expresó..."), sin juicios
- emotional_patterns: máximo 4 patrones usando el vocabulario del marco cuando aplique. Ejemplos: "herida de rechazo", "apego ansioso — búsqueda de validación", "comunicación aplacadora (Satir)", "stonewalling (Gottman)", "límites difusos con figura materna (Minuchin)". Si no aplica el marco, describe con claridad clínica.
- predominant_emotions: máximo 3 emociones con precisión (tristeza, rabia, miedo, vergüenza, soledad, esperanza, etc.)
- reformulation: frase cálida desde el personalismo — centrada en la dignidad, la capacidad de sanar y el sentido. No genérica ni trivial.
- crisis_detected: true solo si hay indicios claros de riesgo para la vida o seguridad

Responde ÚNICAMENTE con el JSON, sin explicaciones.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: analysisPrompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extraer JSON de la respuesta
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Error al procesar el análisis' }, { status: 500 })
    }

    const parsed = PatternSchema.safeParse(JSON.parse(jsonMatch[0]))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Formato de análisis inválido' }, { status: 500 })
    }

    const patternData = parsed.data

    // Guardar patrones en DB
    const { error: patternError } = await supabase
      .from('patterns')
      .upsert({
        session_id: sessionId,
        patient_id: user.id,
        summary: patternData.summary,
        emotional_patterns: patternData.emotional_patterns,
        predominant_emotions: patternData.predominant_emotions,
        reformulation: patternData.reformulation,
        crisis_detected: patternData.crisis_detected,
        raw_json: patternData,
      })

    if (patternError) {
      return NextResponse.json({ error: 'Error al guardar patrones' }, { status: 500 })
    }

    // Marcar sesión como completada
    await supabase
      .from('sessions')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', sessionId)

    // Análisis automático ligero para el terapeuta (fire-and-forget, no bloquea la respuesta)
    triggerAutoAnalysis(user.id, supabase).catch(() => {})

    return NextResponse.json({ success: true, pattern: patternData })
  } catch (error) {
    console.error('Error en /api/patterns:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
