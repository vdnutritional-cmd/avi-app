import { NextRequest, NextResponse, after } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { RECUPERATE_SYSTEM_PROMPT } from '@/lib/prompts/recuperate-system-prompt'
import { getPatientContacto } from '@/lib/patient-contacto'
import { sendCrisisPush } from '@/lib/push/send-crisis-push'
import { sendExpoCrisisPush } from '@/lib/push/send-expo-push'
import { sendCrisisEmail } from '@/lib/email/send-crisis-email'
import { createAdminClient } from '@/lib/supabase/admin'
import { cerrarSesionesAbiertas } from '@/lib/cerrar-sesion-avi'
import { retrievePasajesPersonalismo } from '@/lib/rag/retrieve-chunks'

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

    // cierreSolicitado: el paciente presionó "Terminar" mientras hablaba o AVI respondía
    const { message, sessionId, cierreSolicitado } = await request.json()

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

      // Sesiones anteriores que quedaron abiertas (el paciente cerró la app de golpe):
      // se cierran y analizan después de responder, sin retrasar el chat
      const nuevaId = newSession.id as string
      after(() => cerrarSesionesAbiertas(createAdminClient(), { patientId: user.id, exceptoSessionId: nuevaId })
        .then(r => { if (r.cerradas || r.errores) console.log('[chat] Sesiones anteriores cerradas:', r) })
        .catch(err => console.error('[chat] Error cerrando sesiones anteriores:', err)))
    }

    // Historial de esta sesión: los ÚLTIMOS 30 mensajes (antes tomaba los primeros 20
    // y en sesiones largas AVI perdía lo más reciente). Va en caché (ver más abajo).
    const { data: historyDesc } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', activeSessionId)
      .order('created_at', { ascending: false })
      .limit(30)
    const history = (historyDesc ?? []).reverse()

    // Guardar mensaje del usuario
    await supabase
      .from('messages')
      .insert({ session_id: activeSessionId, role: 'user', content: message })

    // Contexto personalizado del paciente: nota inicial + sesiones presenciales
    // Vínculo ACTIVO (un paciente transferido tiene además vínculos archivados)
    const { data: relacionRows } = await supabase
      .from('therapist_patients')
      .select('therapist_id, initial_note, initial_note_motivo, initial_note_subyacente, initial_note_premisas')
      .eq('patient_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
    const rel = relacionRows?.[0] ?? null
    const terapeutaId = rel?.therapist_id as string | undefined

    const admin = createAdminClient()
    const [sesionesRes, expedienteRes, contacto] = await Promise.all([
      // Últimas 2 sesiones presenciales de su terapeuta actual
      terapeutaId
        ? supabase
            .from('therapist_session_notes')
            .select('session_number, session_date, session_objetivo, session_desarrollo, notes')
            .eq('patient_id', user.id)
            .eq('therapist_id', terapeutaId)
            .order('session_number', { ascending: false })
            .limit(2)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      // Prediagnóstico (SIN el diagnóstico) y análisis familiares — cliente admin: el
      // paciente no tiene acceso directo a su expediente clínico
      terapeutaId
        ? admin
            .from('patient_expediente')
            .select('tipo_caso, individual_prediag_impresion, individual_prediag_areas, individual_prediag_tipo, individual_prediag_detonadores, individual_prediag_guia, fam_ciclo_vital_analisis, fam_procesos_analisis')
            .eq('patient_id', user.id)
            .eq('therapist_id', terapeutaId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      getPatientContacto(user.id).catch(() => null),
    ])

    // Contacto para la invitación de cierre (empresa CONVENIO o terapeuta) — misma regla que la bienvenida
    const bloqueContacto = `## CONTACTO DEL PACIENTE\nEn la invitación de cierre, invita a contactar a ${contacto?.destino ?? 'tu terapeuta'}.`

    // Honestidad: AVI solo responde a lo que realmente está en la conversación.
    // Evita que "invente" algo que el paciente no dijo (p. ej. grabó silencio y luego
    // pregunta "¿qué opinas de lo que dije?"). Bloque aparte: el prompt base sigue en caché.
    const bloqueHonestidad = `## SOLO LO QUE REALMENTE SE DIJO\nLa conversación llega por voz y a veces no se escucha nada. Básate únicamente en lo que aparece escrito en los mensajes de esta sesión.\n- Si el paciente pregunta tu opinión o se refiere a algo que dijo, contó, mostró o hizo ("¿qué opinas?", "¿te gustó?", "¿qué te parece lo que dije?") y eso NO aparece en los mensajes, no lo inventes ni supongas su contenido. Responde con calidez algo como: "No escuché lo que dijiste o no se alcanzó a escuchar. ¿Me lo puedes repetir, por favor?"\n- Nunca afirmes haber visto, oído o recibido algo que no está en la conversación.`

    // El paciente presionó "Terminar la sesión" mientras hablaba: si su mensaje dice que
    // fue un error o que quiere seguir, AVI continúa y lo marca con [CONTINUAR_SESION].
    // Bloque aparte (el prompt base sigue en caché).
    const bloqueCierreSolicitado = cierreSolicitado
      ? `## SOLICITUD DE CIERRE\nEl paciente presionó el botón "Terminar la sesión" mientras hablaba. Después de tu respuesta, la aplicación dirá automáticamente el mensaje de despedida y cerrará la sesión.\n- Si en este mensaje el paciente indica que fue un error o que quiere seguir (por ejemplo: "no, me equivoqué", "no cierres", "quiero seguir hablando" o algo equivalente), responde con normalidad para continuar la conversación y agrega al final exactamente esta marca: [CONTINUAR_SESION]\n- Si no, responde con normalidad y brevemente, sin despedirte ni agregar la marca [SESION_TERMINADA]: la despedida la dice la aplicación.`
      : ''

    const sesiones = (sesionesRes.data ?? []).reverse()
    const exp = expedienteRes.data as Record<string, unknown> | null
    const txt = (v: unknown) => (v == null ? '' : (typeof v === 'string' ? v : JSON.stringify(v)).trim())
    const bloquePrediag = exp
      ? [
          txt(exp.tipo_caso)                      ? `Tipo de caso: ${txt(exp.tipo_caso)}`                         : '',
          txt(exp.individual_prediag_impresion)   ? `Impresión: ${txt(exp.individual_prediag_impresion)}`         : '',
          txt(exp.individual_prediag_tipo)        ? `Tipo de problema: ${txt(exp.individual_prediag_tipo)}`       : '',
          txt(exp.individual_prediag_areas)       ? `Áreas de trabajo: ${txt(exp.individual_prediag_areas)}`      : '',
          txt(exp.individual_prediag_detonadores) ? `Detonadores: ${txt(exp.individual_prediag_detonadores)}`     : '',
          txt(exp.individual_prediag_guia)        ? `Guía de abordaje: ${txt(exp.individual_prediag_guia)}`       : '',
          txt(exp.fam_ciclo_vital_analisis)       ? `Ciclo vital familiar: ${txt(exp.fam_ciclo_vital_analisis)}`  : '',
          txt(exp.fam_procesos_analisis)          ? `Procesos familiares: ${txt(exp.fam_procesos_analisis)}`      : '',
        ].filter(Boolean).join('\n')
      : ''

    const bloqueNotaInicial = rel
      ? [
          rel.initial_note          ? `Desarrollo del caso: ${rel.initial_note}`                   : '',
          rel.initial_note_motivo   ? `Motivo de consulta: ${rel.initial_note_motivo}`             : '',
          rel.initial_note_subyacente ? `Motivo subyacente: ${rel.initial_note_subyacente}`       : '',
          rel.initial_note_premisas ? `Premisas clínicas: ${rel.initial_note_premisas}`           : '',
        ].filter(Boolean).join('\n')
      : ''

    const bloqueSesiones = sesiones.length > 0
      ? sesiones.map(s => {
          const partes = [
            `Sesión ${s.session_number} (${s.session_date}):`,
            s.session_objetivo   ? `  Objetivo: ${s.session_objetivo}`   : '',
            s.session_desarrollo ? `  Desarrollo: ${s.session_desarrollo}` : '',
            s.notes              ? `  Notas: ${s.notes}`                  : '',
          ].filter(Boolean)
          return partes.join('\n')
        }).join('\n\n')
      : ''

    const contextoPaciente = [
      bloqueNotaInicial ? `## CONTEXTO DEL PROCESO TERAPÉUTICO DE ESTE PACIENTE\nUsa esta información para personalizar tu acompañamiento. NO la menciones directamente ni la cites textualmente — solo úsala para que tus respuestas sean más cercanas y coherentes con su proceso real.\n\n### Sesión inicial\n${bloqueNotaInicial}` : '',
      bloqueSesiones ? `### Sesiones presenciales recientes\n${bloqueSesiones}` : '',
      bloquePrediag ? `### Orientación clínica del terapeuta\nSolo para orientar tus preguntas y tu acompañamiento. NUNCA la menciones, no uses etiquetas ni términos clínicos con el paciente y no le digas lo que su terapeuta escribió.\n${bloquePrediag}` : '',
    ].filter(Boolean).join('\n\n')

    // ── Base personalista (RAG docs-personalismo): 3 pasajes por sesión ──────────
    // Se buscan una sola vez (al primer intercambio) y se guardan en la sesión, para
    // que el bloque fijo sea idéntico en todos los intercambios y se aproveche el caché.
    let pasajes = ''
    const { data: sesionRow, error: sesionRowError } = await admin
      .from('sessions').select('rag_personalista').eq('id', activeSessionId).maybeSingle()
    if (!sesionRowError && sesionRow?.rag_personalista) {
      pasajes = sesionRow.rag_personalista as string
    } else {
      const primerMensaje = history.find(m => m.role === 'user')?.content ?? message
      const consulta = [rel?.initial_note_motivo, rel?.initial_note_subyacente, exp?.individual_prediag_areas, exp?.individual_prediag_detonadores, primerMensaje]
        .map(txt).filter(Boolean).join('\n')
      pasajes = await retrievePasajesPersonalismo(consulta).catch(() => '')
      if (pasajes && !sesionRowError) {
        await admin.from('sessions').update({ rag_personalista: pasajes }).eq('id', activeSessionId)
      }
    }
    const bloquePersonalismo = pasajes
      ? `## PASAJES DE TU BASE PERSONALISTA\nEstos pasajes amplían tus fundamentos personalistas para esta persona. Úsalos para orientar tu acompañamiento, sin repetirlos, sin citarlos y sin nombrar autores ni libros. Tu estilo sigue siendo cálido, sencillo y breve.\n\n${pasajes}`
      : ''

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
      sendExpoCrisisPush({ patientId: user.id, sessionId: activeSessionId })
        .catch(err => console.error('Error enviando expo push de crisis (keywords):', err))
      sendCrisisEmail({ patientId: user.id, sessionId: activeSessionId })
        .catch(err => console.error('Error enviando email de crisis (keywords):', err))
    }

    // ── Caché (Anthropic) ──────────────────────────────────────────────────────
    // Haiku 4.5 solo cachea bloques de ≥ 4,096 tokens: el prompt base solo (~3,063)
    // NO llegaba y nunca se cacheó. Ahora el punto de caché va al final de TODO el
    // bloque fijo de la sesión (prompt + paciente + contacto + honestidad + pasajes,
    // ~5,300–6,300 tokens), que no cambia entre intercambios.
    const bloquesFijos = [
      RECUPERATE_SYSTEM_PROMPT,
      contextoPaciente,
      bloqueContacto,
      bloqueHonestidad,
      bloquePersonalismo,
    ].filter(Boolean)

    // Historial + mensaje nuevo; segundo punto de caché en el mensaje nuevo: en el
    // siguiente intercambio, la conversación anterior se lee del caché (10%)
    const messages: Anthropic.MessageParam[] = [
      ...history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { role: 'user', content: [{ type: 'text', text: message, cache_control: { type: 'ephemeral' } }] as any },
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
        system: [
          ...bloquesFijos.map((texto, i) => i === bloquesFijos.length - 1
            ? { type: 'text', text: texto, cache_control: { type: 'ephemeral' } }
            : { type: 'text', text: texto }),
          // Variable: va DESPUÉS del punto de caché
          ...(bloqueCierreSolicitado ? [{ type: 'text', text: bloqueCierreSolicitado }] : []),
        ] as any,
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
            // Verificación del caché en los logs de Vercel
            if (chunk.type === 'message_start') {
              const u = chunk.message.usage as unknown as Record<string, number>
              console.log(`[chat] tokens entrada=${u.input_tokens} cache_escrito=${u.cache_creation_input_tokens ?? 0} cache_leido=${u.cache_read_input_tokens ?? 0}`)
            }
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
          const aviContinua = assistantMessage.includes('[CONTINUAR_SESION]')

          // Limpiar marcadores del texto guardado en DB
          const cleanMessage = assistantMessage
            .replace('[SESION_TERMINADA]', '')
            .replace('[CRISIS_DETECTADA]', '')
            .replace('[CONTINUAR_SESION]', '')
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
            sendExpoCrisisPush({ patientId: user.id, sessionId: activeSessionId })
              .catch(err => console.error('Error enviando expo push de crisis (AVI):', err))
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
                continuar: aviContinua,
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
