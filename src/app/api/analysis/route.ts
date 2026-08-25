import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildConsultamePrompt } from '@/lib/prompts/consultame-prompt'
import { retrieveRelevantChunks, buildRagQuery } from '@/lib/rag/retrieve-chunks'

export const maxDuration = 300 // 5 minutos — el análisis clínico completo puede tardar

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { patientId } = await request.json()
    if (!patientId) return NextResponse.json({ error: 'patientId requerido' }, { status: 400 })

    // Verificar que el paciente pertenece al terapeuta
    const { data: relation } = await supabase
      .from('therapist_patients')
      .select('patient_id, initial_note, initial_note_motivo, initial_note_subyacente, initial_note_premisas')
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .eq('is_active', true)
      .single()

    if (!relation) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // Límite: 2 análisis on-demand por paciente por mes calendario
    const ahora = new Date()
    const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()

    const { count: analysisCount } = await supabase
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .neq('title', 'Actualización automática')
      .gte('created_at', primerDiaMes)

    if ((analysisCount ?? 0) >= 2) {
      const proximoMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1)
      const fechaStr = proximoMes.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
      return NextResponse.json({
        error: `Límite mensual alcanzado. Ya se generaron 2 análisis este mes para este paciente. El próximo estará disponible el ${fechaStr}.`
      }, { status: 429 })
    }

    // ── Obtener tier del terapeuta ────────────────────────────────────────────
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('therapist_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const tier: 'esencial' | 'clinico' = subData?.tier === 'clinico' ? 'clinico' : 'esencial'

    // ── Perfil del paciente ───────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', patientId)
      .single()

    // ── Sesiones AVI: últimas 4 para Esencial, todas para Clínico ────────────
    const patternsBase = supabase
      .from('patterns')
      .select('summary, emotional_patterns, predominant_emotions, reformulation, crisis_detected, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    const { data: patternsDesc } = await (tier === 'esencial' ? patternsBase.limit(4) : patternsBase)
    const patterns = (patternsDesc ?? []).reverse()

    // ── Sesiones presenciales (todas, siempre) ────────────────────────────────
    const { data: inPersonRaw } = await supabase
      .from('therapist_session_notes')
      .select('session_number, session_date, session_objetivo, session_desarrollo, notes')
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .order('session_number', { ascending: true })

    // ── Expediente: siempre SELECT * (el prompt builder filtra por tier) ──────
    const { data: expedienteRow } = await supabase
      .from('patient_expediente')
      .select('*')
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .maybeSingle()

    const patientName = profile?.full_name ?? 'el consultante'

    // ── Normalizar sesiones ───────────────────────────────────────────────────
    const sessionSummaries = patterns.map(p => ({
      date: new Date(p.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
      rawDate: p.created_at,
      summary: p.summary,
      emotions: p.predominant_emotions ?? [],
      patterns: p.emotional_patterns ?? [],
      reformulation: p.reformulation,
      crisisDetected: p.crisis_detected ?? false,
    }))

    const inPersonSessions = (inPersonRaw ?? []).map(s => ({
      sessionNumber: s.session_number,
      sessionDate: new Date(s.session_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
      rawDate: s.session_date,
      objetivo:   s.session_objetivo   ?? '',
      desarrollo: s.session_desarrollo ?? '',
      notes:      s.notes              ?? '',
    }))

    // ── Lógica de decisión del Plan (solo para Clínico) ───────────────────────
    type PlanDecision =
      | { tipo: 'sin-prediag' }
      | { tipo: 'prediag-mayor'; viasAccion: string }
      | { tipo: 'prediag-menor'; viasAccion: string; sesionesPost: typeof inPersonSessions }

    let planDecision: PlanDecision = { tipo: 'sin-prediag' }

    if (tier === 'clinico' && expedienteRow) {
      const exp = expedienteRow as Record<string, unknown>
      const prediagFecha  = exp.prediag_fecha            as string | null
      const viasAccion    = exp.individual_vias_accion   as string | null
      const tienePrediag  = !!(prediagFecha && viasAccion?.trim())

      if (tienePrediag) {
        const prediagDate  = new Date(prediagFecha! + 'T00:00:00')
        const lastPresencial = inPersonSessions.length > 0
          ? inPersonSessions[inPersonSessions.length - 1]
          : null

        if (!lastPresencial || prediagDate >= new Date(lastPresencial.rawDate)) {
          // Prediagnóstico es igual o más reciente que la última sesión presencial
          planDecision = { tipo: 'prediag-mayor', viasAccion: viasAccion! }
        } else {
          // Hay sesiones presenciales con fecha posterior al prediagnóstico
          const sesionesPost = inPersonSessions.filter(
            s => new Date(s.rawDate) > prediagDate
          )
          planDecision = { tipo: 'prediag-menor', viasAccion: viasAccion!, sesionesPost }
        }
      }
    }

    // ── RAG ConsultoriaFuentes ────────────────────────────────────────────────
    const lastInPerson = inPersonSessions.length > 0
      ? inPersonSessions[inPersonSessions.length - 1]
      : undefined

    const ragQuery = buildRagQuery({
      initialNote: relation.initial_note ?? '',
      recentPatterns: patterns.map(p => ({
        summary:             p.summary ?? '',
        emotionalPatterns:   p.emotional_patterns ?? [],
        predominantEmotions: p.predominant_emotions ?? [],
      })),
      lastInPersonSession: lastInPerson ? {
        notes: [lastInPerson.objetivo, lastInPerson.desarrollo, lastInPerson.notes].filter(Boolean).join(' '),
        sessionNumber: lastInPerson.sessionNumber,
      } : undefined,
    })

    console.log('[analysis] Recuperando chunks relevantes con RAG...')
    const fuentes = await retrieveRelevantChunks(ragQuery)
    console.log('[analysis] Fuentes RAG:', fuentes ? `${fuentes.length} chars` : 'sin resultados')
    console.log('[analysis] Tier:', tier, '| Plan decision:', planDecision.tipo)

    // ── Construir prompt ──────────────────────────────────────────────────────
    const prompt = buildConsultamePrompt({
      tier,
      planDecision,
      patientName,
      initialNote:            relation.initial_note           ?? '',
      initialNoteMotivo:      relation.initial_note_motivo    ?? '',
      initialNoteSubyacente:  relation.initial_note_subyacente ?? '',
      initialNotePremisas:    relation.initial_note_premisas  ?? '',
      sessionSummaries,
      inPersonSessions,
      fuentes,
      // Expediente básico (siempre, para compatibilidad)
      expediente: expedienteRow ? {
        antecedentes:        (expedienteRow as Record<string, string>).individual_antecedentes       ?? '',
        sintomatologia:      (expedienteRow as Record<string, string>).individual_sintomatologia      ?? '',
        prediag_impresion:   (expedienteRow as Record<string, string>).individual_prediag_impresion   ?? '',
        prediag_diagnostico: (expedienteRow as Record<string, string>).individual_prediag_diagnostico ?? '',
        prediag_areas:       (expedienteRow as Record<string, string>).individual_prediag_areas       ?? '',
        prediag_tipo:        (expedienteRow as Record<string, string>).individual_prediag_tipo        ?? '',
        prediag_detonadores: (expedienteRow as Record<string, string>).individual_prediag_detonadores ?? '',
        prediag_guia:        (expedienteRow as Record<string, string>).individual_prediag_guia        ?? '',
      } : undefined,
      // Expediente completo (solo para plan Clínico)
      expedienteClinico: tier === 'clinico' && expedienteRow
        ? (expedienteRow as Record<string, unknown>)
        : undefined,
    })

    // ── Streaming SSE ─────────────────────────────────────────────────────────
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = ''
        try {
          console.log('[analysis] Iniciando stream con Anthropic...')
          console.log('[analysis] Longitud del prompt:', prompt.length, 'chars')

          const response = await anthropic.messages.stream({
            model: 'claude-sonnet-5',
            max_tokens: 8000,
            messages: [{ role: 'user', content: prompt }],
          })

          for await (const chunk of response) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text
              fullContent += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }

          console.log('[analysis] Stream completado. Chars generados:', fullContent.length)

          if (fullContent) {
            await supabase.from('analyses').insert({
              therapist_id: user.id,
              patient_id: patientId,
              content: fullContent,
              title: '',
              sessions_analyzed: [],
              techniques_proposed: [],
              session_plan: [],
            })
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (error) {
          console.error('[analysis] Error en stream:', error)
          const msg = error instanceof Error ? error.message : 'Error generando análisis'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error en /api/analysis:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── PATCH: guardar nota inicial del terapeuta ─────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const {
      patientId, initialNote, initialNoteDate, initialNoteProBono, initialNoteVirtual,
      initialNoteMotivo, initialNoteSubyacente, initialNotePremisas,
    } = await request.json()
    if (!patientId) return NextResponse.json({ error: 'patientId requerido' }, { status: 400 })

    const updateData: Record<string, unknown> = {
      initial_note: initialNote,
      initial_note_updated_at: new Date().toISOString(),
    }
    if (initialNoteDate      !== undefined) updateData.initial_note_date       = initialNoteDate
    if (initialNoteProBono   !== undefined) updateData.initial_note_pro_bono   = initialNoteProBono
    if (initialNoteVirtual   !== undefined) updateData.initial_note_virtual     = initialNoteVirtual
    if (initialNoteMotivo    !== undefined) updateData.initial_note_motivo      = initialNoteMotivo
    if (initialNoteSubyacente !== undefined) updateData.initial_note_subyacente = initialNoteSubyacente
    if (initialNotePremisas  !== undefined) updateData.initial_note_premisas    = initialNotePremisas

    const { data: updated, error } = await supabase
      .from('therapist_patients')
      .update(updateData)
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .select()

    if (error) {
      console.error('[analysis PATCH] Error al guardar nota:', error)
      return NextResponse.json({ error: 'Error al guardar nota: ' + error.message }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      console.error('[analysis PATCH] 0 filas actualizadas — falta política RLS de UPDATE en therapist_patients')
      return NextResponse.json({ error: 'No se pudo guardar la nota. Falta política RLS de UPDATE en therapist_patients.' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
