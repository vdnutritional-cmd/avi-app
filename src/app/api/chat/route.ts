import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { RECUPERATE_SYSTEM_PROMPT } from '@/lib/prompts/recuperate-system-prompt'
import { sendCrisisPush } from '@/lib/push/send-crisis-push'
import { sendCrisisEmail } from '@/lib/email/send-crisis-email'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Keywords básicas de crisis (Sprint 3 tendrá versión más robusta)
const CRISIS_KEYWORDS = [
  'suicidarme', 'suicidio', 'matarme', 'quitarme la vida', 'no quiero vivir',
  'hacerme daño', 'cortarme', 'lastimarme', 'morir', 'sin salida',
  'me golpea', 'me pega', 'violencia', 'me hace daño', 'me amenaza',
]

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase()
  return CRISIS_KEYWORDS.some(kw => lower.includes(kw))
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que es paciente
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'patient') {
      return NextResponse.json({ error: 'Solo pacientes pueden usar el chat' }, { status: 403 })
    }

    const { message, sessionId } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
    }

    // Crear o recuperar sesión activa
    let activeSessionId = sessionId

    if (!activeSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({ patient_id: user.id, status: 'active' })
        .select('id')
        .single()

      if (sessionError || !newSession) {
        return NextResponse.json({ error: 'No se pudo crear la sesión' }, { status: 500 })
      }
      activeSessionId = newSession.id
    }

    // Obtener historial de mensajes de esta sesión (máx últimos 20)
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', activeSessionId)
      .order('created_at', { ascending: true })
      .limit(20)

    // Guardar mensaje del usuario
    await supabase
      .from('messages')
      .insert({ session_id: activeSessionId, role: 'user', content: message })

    // Detectar crisis
    const hasCrisis = detectCrisis(message)
    if (hasCrisis) {
      await supabase
        .from('crisis_alerts')
        .insert({
          patient_id: user.id,
          session_id: activeSessionId,
          detected_keywords: CRISIS_KEYWORDS.filter(kw => message.toLowerCase().includes(kw)),
        })
      // Fire-and-forget: notificar push + email al terapeuta
      sendCrisisPush({ patientId: user.id, sessionId: activeSessionId })
        .catch(err => console.error('Error enviando push de crisis (keywords):', err))
      sendCrisisEmail({ patientId: user.id, sessionId: activeSessionId })
        .catch(err => console.error('Error enviando email de crisis (keywords):', err))
    }

    // Preparar mensajes para Claude
    const messages: Anthropic.MessageParam[] = [
      ...(history ?? []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    // Llamar a Claude API con streaming + Prompt Caching en system prompt
    // cache_control: ephemeral → system prompt cacheado entre exchanges de la misma sesión
    // Ahorro: 11 de 12 exchanges leen del caché al 10% del costo normal (~-40% costo total chat)
    const stream = await anthropic.messages.stream(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        // SDK 0.30.1: cache_control no está en TextBlockParam pero sí en la API.
        // Se castea el bloque completo. Actualizar SDK a 0.32+ elimina este cast.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        system: [{ type: 'text', text: RECUPERATE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }] as any,
        messages,
      },
      {
        headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
      }
    )

    // Recopilar respuesta completa para guardar en DB
    let assistantMessage = ''

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const text = chunk.delta.text
              assistantMessage += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }

          // Detectar marcadores especiales de AVI
          const aviClosedSession = assistantMessage.includes('[SESION_TERMINADA]')
          const aviDetectedCrisis = assistantMessage.includes('[CRISIS_DETECTADA]')

          // Limpiar marcadores del texto guardado en DB
          const cleanMessage = assistantMessage
            .replace('[SESION_TERMINADA]', '')
            .replace('[CRISIS_DETECTADA]', '')
            .trim()

          // Guardar respuesta completa de AVI en DB (sin marcadores)
          await supabase
            .from('messages')
            .insert({ session_id: activeSessionId, role: 'assistant', content: cleanMessage })

          // Si AVI detectó crisis, insertar alerta
          if (aviDetectedCrisis && !hasCrisis) {
            await supabase
              .from('crisis_alerts')
              .insert({
                patient_id: user.id,
                session_id: activeSessionId,
                detected_keywords: ['[AVI_INITIATED_CRISIS]'],
              })
            // Fire-and-forget: notificar push + email al terapeuta
            sendCrisisPush({ patientId: user.id, sessionId: activeSessionId })
              .catch(err => console.error('Error enviando push de crisis (AVI):', err))
            sendCrisisEmail({ patientId: user.id, sessionId: activeSessionId })
              .catch(err => console.error('Error enviando email de crisis (AVI):', err))
          }

          // Enviar sessionId y flags al cliente
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                sessionId: activeSessionId,
                crisis: hasCrisis || aviDetectedCrisis,
                autoClose: aviClosedSession,
              })}\n\n`
            )
          )
        } catch (streamError) {
          console.error('Error en stream de Claude:', streamError)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: String(streamError) })}\n\n`
            )
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error en /api/chat:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
