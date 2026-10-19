// ─────────────────────────────────────────────────────────────
// Cierre de una sesión AVI-Consúltame (fuente única)
//
//   procesarCierreSesion(): genera los patrones de la sesión (Haiku), los
//     guarda, marca la sesión como completed y dispara el auto-análisis
//     ligero para el terapeuta. La usan:
//       - POST /api/patterns (botón "Terminar", cierre por AVI o por tiempo)
//       - cerrarSesionesAbiertas() (sesiones que quedaron abiertas)
//
//   cerrarSesionesAbiertas(): cierra sesiones 'active' que quedaron abiertas
//     porque el paciente cerró la app de golpe. Se llama al iniciar una sesión
//     nueva (las anteriores del mismo paciente) y en el barrido diario.
//     Ya NO se cierra la sesión al bloquear la pantalla o cambiar de app.
// Funciona con el cliente de sesión o con el admin (barrido).
// ─────────────────────────────────────────────────────────────
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registrarUso } from '@/lib/ia/registrar-uso'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

// Auto-análisis ligero: sin RAG — solo nota inicial + patrones acumulados.
// El análisis completo con fuentes se genera bajo demanda desde Consúltame.
async function triggerAutoAnalysis(patientId: string, supabase: Db) {
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

  registrarUso('auto_analisis', 'claude-haiku-4-5-20251001', response.usage, { therapistId: relation.therapist_id, patientId })

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

export type ResultadoCierre =
  | { ok: true; pattern: z.infer<typeof PatternSchema> }
  | { ok: false; error: string; status: number }

/** Genera los patrones de la sesión y la marca como completada. */
export async function procesarCierreSesion(db: Db, sessionId: string, patientId: string): Promise<ResultadoCierre> {
    // Obtener todos los mensajes de la sesión
    const { data: messages } = await db
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (!messages || messages.length < 2) {
      return { ok: false, error: 'La sesión tiene muy pocos mensajes para analizar', status: 400 }
    }

    // Construir transcripción para Claude
    const transcript = messages
      .map(m => `${m.role === 'user' ? 'PERSONA' : 'AVI'}: ${m.content}`)
      .join('\n\n')

    const analysisPrompt = `Eres un analista clínico. Analiza la siguiente sesión de acompañamiento emocional y genera un resumen estructurado en JSON.

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

    registrarUso('patrones_cierre', 'claude-haiku-4-5-20251001', response.usage, { patientId })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extraer JSON de la respuesta
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { ok: false, error: 'Error al procesar el análisis', status: 500 }
    }

    const parsed = PatternSchema.safeParse(JSON.parse(jsonMatch[0]))
    if (!parsed.success) {
      return { ok: false, error: 'Formato de análisis inválido', status: 500 }
    }

    const patternData = parsed.data

    // Guardar patrones en DB
    const { error: patternError } = await db
      .from('patterns')
      .upsert({
        session_id: sessionId,
        patient_id: patientId,
        summary: patternData.summary,
        emotional_patterns: patternData.emotional_patterns,
        predominant_emotions: patternData.predominant_emotions,
        reformulation: patternData.reformulation,
        crisis_detected: patternData.crisis_detected,
        raw_json: patternData,
      })

    if (patternError) {
      return { ok: false, error: 'Error al guardar patrones', status: 500 }
    }

    // Marcar sesión como completada
    await db
      .from('sessions')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', sessionId)

    // Análisis automático ligero para el terapeuta (fire-and-forget, no bloquea la respuesta)
    triggerAutoAnalysis(patientId, db).catch(() => {})

    return { ok: true, pattern: patternData }
}

/**
 * Cierra las sesiones 'active' que quedaron abiertas.
 *   - patientId: solo las de ese paciente (al iniciar una sesión nueva)
 *   - exceptoSessionId: no tocar la sesión en curso
 *   - minutosSinActividad: solo las que llevan al menos ese tiempo sin mensajes
 * Con menos de 2 mensajes no hay nada que analizar: solo se marca completed.
 */
export async function cerrarSesionesAbiertas(db: Db, opts: {
  patientId?: string
  exceptoSessionId?: string
  minutosSinActividad?: number
} = {}): Promise<{ cerradas: number; errores: number }> {
  let q = db.from('sessions').select('id, patient_id, started_at').eq('status', 'active')
  if (opts.patientId) q = q.eq('patient_id', opts.patientId)
  if (opts.exceptoSessionId) q = q.neq('id', opts.exceptoSessionId)
  const { data: abiertas } = await q

  const limite = Date.now() - (opts.minutosSinActividad ?? 0) * 60_000
  let cerradas = 0, errores = 0
  for (const s of abiertas ?? []) {
    const { data: ultimo } = await db.from('messages')
      .select('created_at').eq('session_id', s.id)
      .order('created_at', { ascending: false }).limit(1)
    const ultimaActividad = new Date((ultimo?.[0]?.created_at as string | undefined) ?? (s.started_at as string)).getTime()
    if (ultimaActividad > limite) continue

    const { count } = await db.from('messages').select('*', { count: 'exact', head: true }).eq('session_id', s.id)
    if ((count ?? 0) < 2) {
      await db.from('sessions').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', s.id)
      cerradas++
      continue
    }
    const r = await procesarCierreSesion(db, s.id as string, s.patient_id as string)
    if (r.ok) cerradas++
    else { errores++; console.error('[cerrar-sesion] No se pudo cerrar', s.id, r.error) }
  }
  return { cerradas, errores }
}
