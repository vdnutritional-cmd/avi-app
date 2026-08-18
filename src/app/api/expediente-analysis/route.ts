import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { retrieveRelevantChunks, retrieveChunksFromBooks } from '@/lib/rag/retrieve-chunks'

export const maxDuration = 180

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Helpers a nivel de módulo ─────────────────────────────────────────────────

function buildNotaInicial(relation: {
  initial_note: string | null
  initial_note_motivo: string | null
  initial_note_subyacente: string | null
  initial_note_premisas: string | null
}): string {
  return [
    `1. DESARROLLO DEL CASO:\n${relation.initial_note || '(Sin registrar)'}`,
    `2. MOTIVO DE CONSULTA DEL PACIENTE:\n${relation.initial_note_motivo || '(Sin registrar)'}`,
    `3. MOTIVO DE CONSULTA SUBYACENTE:\n${relation.initial_note_subyacente || '(Sin registrar)'}`,
    `4. PREMISAS ANTE EL MOTIVO DE CONSULTA:\n${relation.initial_note_premisas || '(Sin registrar)'}`,
  ].join('\n\n')
}

// Extrae el primer bloque de texto de una respuesta de Anthropic
function extractTextFromResponse(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text' && block.text.trim().length > 0) {
      return block.text.trim()
    }
  }
  return ''
}

// ── Ruta POST ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { type, patientId, dimensiones, contexto, antecedentes, sintomatologia, prediagnostico, familiar } = body

    if (!type || !patientId) {
      return NextResponse.json({ error: 'Faltan parámetros: type y patientId' }, { status: 400 })
    }

    // Nota Inicial del paciente
    const { data: relation } = await supabase
      .from('therapist_patients')
      .select('initial_note, initial_note_motivo, initial_note_subyacente, initial_note_premisas')
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .single()

    if (!relation) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    const notaInicial = buildNotaInicial(relation)

    // ── Sesiones presenciales + últimas 4 AVI (base compartida por varios análisis) ──
    const [inPersonRes, patternsRes] = await Promise.all([
      supabase
        .from('therapist_session_notes')
        .select('session_number, session_date, session_objetivo, session_desarrollo, notes')
        .eq('therapist_id', user.id)
        .eq('patient_id', patientId)
        .order('session_number', { ascending: true }),
      supabase
        .from('patterns')
        .select('summary, emotional_patterns, predominant_emotions, crisis_detected, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(4),
    ])

    const sesionesPresenciales = inPersonRes.data ?? []
    const ultimasAVI = (patternsRes.data ?? []).reverse()

    const sesionesPresencialesTexto = sesionesPresenciales.length > 0
      ? sesionesPresenciales.map(s => {
          const partes = [
            `Sesión Presencial ${s.session_number} (${new Date(s.session_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })})`,
            s.session_objetivo  ? `Objetivo: ${s.session_objetivo}`     : '',
            s.session_desarrollo ? `Desarrollo: ${s.session_desarrollo}` : '',
            s.notes              ? `Observaciones: ${s.notes}`           : '',
          ].filter(Boolean)
          return partes.join(' | ')
        }).join('\n')
      : ''

    const sesionesAVITexto = ultimasAVI.length > 0
      ? ultimasAVI.map((p, i) =>
          [
            `Sesión AVI ${i + 1} (${new Date(p.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })})`,
            `Resumen: ${p.summary}`,
            `Emociones: ${(p.predominant_emotions ?? []).join(', ')}`,
            `Patrones: ${(p.emotional_patterns ?? []).join(', ')}`,
            p.crisis_detected ? '⚠️ Crisis detectada.' : '',
          ].filter(Boolean).join(' | ')
        ).join('\n')
      : ''

    const sesionesBloque = [
      sesionesPresencialesTexto ? `SESIONES PRESENCIALES:\n${sesionesPresencialesTexto}` : '',
      sesionesAVITexto         ? `SESIONES AVI (últimas 4):\n${sesionesAVITexto}`         : '',
    ].filter(Boolean).join('\n\n')

    // ── ANTECEDENTES DE RELEVANCIA (2 bloques, máx. 200 palabras c/u) ────────
    if (type === 'antecedentes') {
      const prompt = [
        'Eres supervisor clínico con amplia experiencia en consulta.',
        'Basándote en la Nota Inicial, redacta los Antecedentes de Relevancia en DOS bloques distintos y bien diferenciados.',
        '',
        'BLOQUE 1 — Antecedentes de relevancia:',
        'Historia familiar y de origen, relaciones estructurales significativas, eventos de vida relevantes y contexto de desarrollo del consultante.',
        'Si algún dato no es explícito, infiere lo razonable a partir del contexto.',
        'Máximo 200 palabras. Condensa con criterio clínico — no truncues, sintetiza todo lo relevante dentro del límite.',
        '',
        'BLOQUE 2 — Contexto del motivo de consulta:',
        'Síntesis del motivo de consulta del paciente, el motivo subyacente identificado y las premisas clínicas iniciales ante el caso.',
        'Máximo 200 palabras. Mismo criterio: condensa sin truncar.',
        '',
        'Formato de respuesta (usa exactamente estas etiquetas):',
        '**Antecedentes de relevancia:**',
        '[contenido del bloque 1]',
        '',
        '**Contexto del motivo de consulta:**',
        '[contenido del bloque 2]',
        '',
        'Lenguaje profesional pero directo y cercano — como lo escribiría un clínico experimentado, no un ensayo académico.',
        'Responde SOLO con los dos bloques, sin texto adicional antes ni después.',
        '',
        'NOTA INICIAL:',
        notaInicial,
        ...(sesionesBloque ? ['', 'SESIONES DEL CONSULTANTE:', sesionesBloque] : []),
      ].join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = extractTextFromResponse(response.content)
      console.log('[antecedentes] stop_reason:', response.stop_reason, '| chars:', text.length)

      if (!text) {
        return NextResponse.json(
          { error: 'El modelo no generó contenido. Asegúrate de que la Nota Inicial tenga información.' },
          { status: 422 }
        )
      }
      return NextResponse.json({ result: text })
    }

    // ── SINTOMATOLOGÍA OBSERVADA (máx. 100 palabras) ─────────────────────────
    if (type === 'sintomatologia') {
      const prompt = [
        'Eres supervisor clínico con amplia experiencia en consulta.',
        'Basándote en la Nota Inicial, describe la sintomatología que presenta el consultante: lo que se observa o reporta en su conducta, afecto, pensamiento y relaciones.',
        'Lenguaje profesional pero accesible — sin jerga diagnóstica excesiva.',
        'Sintetiza la sintomatología COMPLETA en máximo 100 palabras. No truncues: condensa con criterio clínico toda la información relevante dentro del límite.',
        'Responde directamente con el párrafo, sin título ni encabezado.',
        '',
        'NOTA INICIAL:',
        notaInicial,
        ...(sesionesBloque ? ['', 'SESIONES DEL CONSULTANTE:', sesionesBloque] : []),
      ].join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = extractTextFromResponse(response.content)
      console.log('[sintomatologia] stop_reason:', response.stop_reason, '| chars:', text.length)

      if (!text) {
        return NextResponse.json(
          { error: 'El modelo no generó contenido. Asegúrate de que la Nota Inicial tenga información.' },
          { status: 422 }
        )
      }
      return NextResponse.json({ result: text })
    }

    // ── PREDIAGNÓSTICO (6 incisos, máx. 75 palabras c/u) ────────────────────
    if (type === 'prediagnostico') {
      // RAG: recuperar documentos ConsultoriaFuentes relevantes para el prediagnóstico
      const prediagRagQuery = [
        notaInicial,
        `Dimensiones: ${(dimensiones ?? []).join(', ')}`,
        `Contexto: ${contexto || ''}`,
        antecedentes || '',
        sintomatologia || '',
      ].filter(Boolean).join('\n\n').slice(0, 6000)

      const fuentesPrediag = await retrieveRelevantChunks(prediagRagQuery)

      const prompt = [
        'Eres supervisor clínico con amplia experiencia en consulta. Elabora un prediagnóstico clínico del caso.',
        'Devuelve ÚNICAMENTE un objeto JSON con exactamente estas 6 claves.',
        'Máximo 75 palabras por campo. Sintetiza con claridad — no truncues, condensa toda la información relevante de cada inciso dentro del límite indicado.',
        'Escribe como lo haría un clínico experimentado: directo, profesional y accesible, sin jerga académica excesiva.',
        'Genera contenido sustantivo en cada campo — si hay poca información explícita, razona a partir del contexto disponible.',
        'Solo usa cadena vacía "" si definitivamente no hay ningún dato para ese campo.',
        '',
        'Formato (responde SOLO con este JSON, sin texto antes ni después):',
        '{',
        '  "impresion": "...",',
        '  "diagnostico": "...",',
        '  "areas_conflicto": "...",',
        '  "tipo_problema": "...",',
        '  "detonadores": "...",',
        '  "guia_accion": "..."',
        '}',
        '',
        ...(fuentesPrediag ? ['FUENTES CLÍNICAS (ConsultoriaFuentes — úsalas para fundamentar el prediagnóstico):', fuentesPrediag, ''] : []),
        'NOTA INICIAL:',
        notaInicial,
        '',
        'INFORMACIÓN ADICIONAL DEL CASO:',
        `- Dimensiones evolutivas: ${(dimensiones ?? []).join(', ') || 'No especificadas'}`,
        `- Contexto: ${contexto || 'No especificado'}`,
        `- Antecedentes de relevancia: ${antecedentes || 'No disponible aún'}`,
        `- Sintomatología observada: ${sintomatologia || 'No disponible aún'}`,
      ].join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = extractTextFromResponse(response.content)
      console.log('[prediagnostico] stop_reason:', response.stop_reason, '| raw:', raw.slice(0, 200))

      if (!raw) {
        return NextResponse.json(
          { error: 'El modelo no generó contenido. Intenta de nuevo.' },
          { status: 422 }
        )
      }

      let parsed: Record<string, string> = {}
      try {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) {
          parsed = JSON.parse(match[0])
        } else {
          console.error('[prediagnostico] No se encontró JSON en:', raw)
          return NextResponse.json(
            { error: 'La respuesta no tenía formato JSON válido. Intenta de nuevo.' },
            { status: 500 }
          )
        }
      } catch (e) {
        console.error('[prediagnostico] Error al parsear JSON:', e)
        return NextResponse.json(
          { error: 'Error al procesar la respuesta. Intenta de nuevo.' },
          { status: 500 }
        )
      }

      const tieneContenido = Object.values(parsed).some(v => typeof v === 'string' && v.trim().length > 0)
      if (!tieneContenido) {
        return NextResponse.json(
          { error: 'El análisis no generó contenido. Verifica que la Nota Inicial tenga información suficiente.' },
          { status: 422 }
        )
      }

      return NextResponse.json({ result: parsed })
    }

    // ── VÍAS DE ACCIÓN — Plan 10 sesiones (streaming + RAG) ──────────────────
    if (type === 'vias-accion') {
      const ragQuery = [
        notaInicial,
        `Dimensiones: ${(dimensiones ?? []).join(', ')}`,
        `Contexto: ${contexto || ''}`,
        antecedentes || '',
        sintomatologia || '',
      ].filter(Boolean).join('\n\n').slice(0, 6000)

      const fuentes = await retrieveRelevantChunks(ragQuery)

      const prediagBloque = prediagnostico ? [
        'PREDIAGNÓSTICO DEL CASO:',
        `- Impresión del sujeto: ${prediagnostico.impresion || '—'}`,
        `- Diagnóstico presuntivo: ${prediagnostico.diagnostico || '—'}`,
        `- Áreas de conflicto: ${prediagnostico.areas_conflicto || '—'}`,
        `- Tipo de problema: ${prediagnostico.tipo_problema || '—'}`,
        `- Detonadores: ${prediagnostico.detonadores || '—'}`,
        `- Guía de acción: ${prediagnostico.guia_accion || '—'}`,
      ].join('\n') : ''

      const prompt = [
        'Eres supervisor clínico de ConsultoriaFuentes.',
        'Elabora un plan clínico detallado de 10 sesiones basado en toda la información del caso y las fuentes de referencia.',
        'Para cada sesión: objetivo clínico concreto, técnica específica (nombre y autor de las fuentes), cómo aplicarla exactamente con este paciente, resultado esperado.',
        'Nada genérico — todo aplicado al caso.',
        '',
        'FUENTES CLÍNICAS (ConsultoriaFuentes):',
        fuentes || '(Sin fuentes recuperadas — elabora con base en el caso)',
        '',
        'NOTA INICIAL:',
        notaInicial,
        '',
        'INFORMACIÓN DEL CASO:',
        `- Dimensiones evolutivas: ${(dimensiones ?? []).join(', ') || 'No especificadas'}`,
        `- Contexto: ${contexto || 'No especificado'}`,
        `- Antecedentes de relevancia: ${antecedentes || 'No disponible'}`,
        `- Sintomatología observada: ${sintomatologia || 'No disponible'}`,
        prediagBloque,
        ...(sesionesBloque ? ['', 'SESIONES DEL CONSULTANTE:', sesionesBloque] : []),
        '',
        'Formato de cada sesión (respeta este formato exacto y NO excedas 120 palabras por sesión en total):',
        '**Sesión [N] — [Objetivo principal]**',
        'Técnica: [nombre y autor — una línea]',
        '',
        'Aplicación: [2-3 oraciones concretas de cómo se aplica con este paciente]',
        'Meta: [una oración con el resultado esperado]',
        '',
        'IMPORTANTE:',
        '- Máximo 120 palabras por sesión. Sé clínico y directo, sin relleno.',
        '- Entre "Técnica:" y "Aplicación:" deja siempre una línea en blanco.',
        '- Debes generar las 10 sesiones completas. No te detengas antes de la Sesión 10.',
        '- Sin introducción ni conclusión. Empieza directo con la Sesión 1. Todo en español.',
      ].join('\n')

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const response = await anthropic.messages.stream({
              model: 'claude-sonnet-5',
              max_tokens: 8000,
              messages: [{ role: 'user', content: prompt }],
            })

            for await (const chunk of response) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`))
              }
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Error desconocido'
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
    }

    // ── CICLO VITAL (RAG: El_Ciclo_Vital_de_La_Familia) ──────────────────────
    if (type === 'ciclo_vital') {
      // Serializar datos familiares para RAG query
      const famCtx = familiar ? [
        familiar.sintomas       ? `Síntomas: ${familiar.sintomas}`               : '',
        familiar.detonadores    ? `Detonadores: ${familiar.detonadores}`          : '',
        familiar.factores_riesgo? `Factores de riesgo: ${familiar.factores_riesgo}` : '',
        familiar.ciclo_vital    ? `Etapa ciclo vital: ${familiar.ciclo_vital}`    : '',
      ].filter(Boolean).join('\n') : ''

      const ragQuery = [notaInicial, famCtx].filter(Boolean).join('\n\n').slice(0, 6000)
      const fuentes = await retrieveChunksFromBooks(ragQuery, ['El_Ciclo_Vital_de_La_Familia'])

      // Texto legible de los apartados familiares
      const famTexto = familiar ? [
        familiar.sintomas         ? `Síntomas: ${familiar.sintomas}`               : '',
        familiar.detonadores      ? `Detonadores: ${familiar.detonadores}`          : '',
        familiar.factores_riesgo  ? `Factores de riesgo y protección: ${familiar.factores_riesgo}` : '',
        familiar.funciones_texto  ? `Funciones familiares:\n${familiar.funciones_texto}` : '',
        familiar.maternaje?.length? `Maternaje: ${familiar.maternaje.join(', ')}`  : '',
        familiar.paternaje?.length? `Paternaje: ${familiar.paternaje.join(', ')}`  : '',
        familiar.disfunc_tipo     ? `Disfuncionalidad: ${familiar.disfunc_tipo}${familiar.disfunc_opciones?.length ? ` — ${familiar.disfunc_opciones.join(', ')}` : ''}` : '',
        familiar.tipo_disfunc?.length ? `Tipo de disfuncionalidad observada: ${familiar.tipo_disfunc.join('; ')}` : '',
        familiar.ciclo_vital      ? `Etapa del ciclo vital: ${familiar.ciclo_vital}` : '',
      ].filter(Boolean).join('\n') : '(Sin datos familiares aún)'

      const prompt = [
        'Eres supervisor clínico con amplia experiencia en terapia familiar.',
        `Analiza la etapa del ciclo vital de esta familia basándote en todos los datos del caso.`,
        'Máximo 250 palabras. Sé clínico, directo y práctico — nada genérico.',
        'Responde directamente con el análisis, sin título ni encabezado.',
        '',
        ...(fuentes ? ['FUENTE CLÍNICA (El Ciclo Vital de La Familia):', fuentes, ''] : []),
        'NOTA INICIAL DEL CASO:',
        notaInicial,
        ...(sesionesPresencialesTexto ? ['', 'SESIONES PRESENCIALES:', sesionesPresencialesTexto] : []),
        '',
        'DATOS SECCIÓN FAMILIAR:',
        famTexto,
      ].join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = extractTextFromResponse(response.content)
      console.log('[ciclo_vital] stop_reason:', response.stop_reason, '| chars:', text.length)

      if (!text) {
        return NextResponse.json(
          { error: 'El modelo no generó contenido. Asegúrate de que la Nota Inicial tenga información.' },
          { status: 422 }
        )
      }
      return NextResponse.json({ result: text })
    }

    // ── PROCESOS FAMILIARES (RAG: Satir + Minuchin) ───────────────────────────
    if (type === 'procesos_familiares') {
      const famCtx = familiar ? [
        familiar.sintomas         ? `Síntomas: ${familiar.sintomas}`         : '',
        familiar.detonadores      ? `Detonadores: ${familiar.detonadores}`   : '',
        familiar.disfunc_tipo     ? `Disfuncionalidad: ${familiar.disfunc_tipo}` : '',
        familiar.tipo_disfunc?.length ? familiar.tipo_disfunc.join('; ')     : '',
      ].filter(Boolean).join('\n') : ''

      const ragQuery = [notaInicial, famCtx].filter(Boolean).join('\n\n').slice(0, 6000)
      const fuentes = await retrieveChunksFromBooks(ragQuery, [
        'Virginia_Satir_Relaciones_Humanas_Nucleo_Familiar',
        'Tecnicas_de_Terapia_Familiar_Minuchin',
      ])

      const famTexto = familiar ? [
        familiar.sintomas         ? `Síntomas: ${familiar.sintomas}`               : '',
        familiar.detonadores      ? `Detonadores: ${familiar.detonadores}`          : '',
        familiar.factores_riesgo  ? `Factores de riesgo y protección: ${familiar.factores_riesgo}` : '',
        familiar.funciones_texto  ? `Funciones familiares:\n${familiar.funciones_texto}` : '',
        familiar.maternaje?.length? `Maternaje: ${familiar.maternaje.join(', ')}`  : '',
        familiar.paternaje?.length? `Paternaje: ${familiar.paternaje.join(', ')}`  : '',
        familiar.disfunc_tipo     ? `Disfuncionalidad: ${familiar.disfunc_tipo}${familiar.disfunc_opciones?.length ? ` — ${familiar.disfunc_opciones.join(', ')}` : ''}` : '',
        familiar.tipo_disfunc?.length ? `Tipo de disfuncionalidad: ${familiar.tipo_disfunc.join('; ')}` : '',
        familiar.ciclo_vital      ? `Etapa del ciclo vital: ${familiar.ciclo_vital}` : '',
      ].filter(Boolean).join('\n') : '(Sin datos familiares aún)'

      const prompt = [
        'Eres supervisor clínico con amplia experiencia en terapia familiar.',
        'Analiza los PROCESOS FAMILIARES de este caso, abordando específicamente:',
        '  1. LÍMITES — tipos, claridad y permeabilidad en el sistema familiar',
        '  2. PODER — estructura jerárquica, quién ejerce autoridad y cómo',
        '  3. COMUNICACIÓN — patrones, congruencia, doble vínculo, apertura',
        '  4. AFECTO — vínculo emocional, expresión afectiva, apego',
        '',
        'Fundamenta el análisis EXCLUSIVAMENTE en los libros de Virginia Satir y Salvador Minuchin indicados.',
        'Máximo 250 palabras. Estructura los 4 procesos claramente pero en prosa fluida, sin sub-encabezados.',
        'Responde directamente con el análisis, sin título ni introducción.',
        '',
        ...(fuentes ? ['FUENTES CLÍNICAS (Satir y Minuchin):', fuentes, ''] : []),
        'NOTA INICIAL DEL CASO:',
        notaInicial,
        '',
        'DATOS SECCIÓN FAMILIAR:',
        famTexto,
      ].join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = extractTextFromResponse(response.content)
      console.log('[procesos_familiares] stop_reason:', response.stop_reason, '| chars:', text.length)

      if (!text) {
        return NextResponse.json(
          { error: 'El modelo no generó contenido. Asegúrate de que la Nota Inicial tenga información.' },
          { status: 422 }
        )
      }
      return NextResponse.json({ result: text })
    }

    return NextResponse.json({ error: `Tipo no reconocido: ${type}` }, { status: 400 })

  } catch (error) {
    console.error('[expediente-analysis] Error general:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
