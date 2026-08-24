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

// ── Mapas de etiquetas para Familiar ─────────────────────────────────────────
const RIESGO_LABELS: Record<string, string> = {
  limites_difusos:         'Límites difusos o rígidos',
  triangulacion:           'Triangulación',
  parentificacion:         'Parentificación',
  comunicacion_patologica: 'Comunicación patológica',
  rigidez_homeostatica:    'Rigidez homeostática',
  alianzas_destructivas:   'Alianzas e interacciones destructivas',
}

const PROTECCION_LABELS: Record<string, string> = {
  limites_claros:        'Límites claros y flexibles',
  cohesion_familiar:     'Cohesión familiar',
  comunicacion_asertiva: 'Comunicación asertiva y abierta',
  flexibilidad:          'Flexibilidad y adaptabilidad',
  jerarquia_parental:    'Jerarquía parental clara',
  redes_apoyo:           'Redes de apoyo externas',
}

// Construye el texto de contexto de la sub-sección según tipo de caso
function buildSubseccionContexto(
  tipoCaso: string | null,
  exp: Record<string, unknown> | null
): string {
  if (!tipoCaso || !exp) return '(Tipo de caso o sub-sección no definidos aún)'

  if (tipoCaso === 'Individual') {
    const dims = Array.isArray(exp.individual_dimensiones)
      ? (exp.individual_dimensiones as string[]).join(', ')
      : ''
    return [
      dims                          ? `Dimensiones evolutivas: ${dims}`                             : '',
      exp.individual_contexto       ? `Contexto: ${exp.individual_contexto}`                        : '',
      exp.individual_antecedentes   ? `Antecedentes de relevancia:\n${exp.individual_antecedentes}` : '',
      exp.individual_sintomatologia ? `Sintomatología observada: ${exp.individual_sintomatologia}`  : '',
    ].filter(Boolean).join('\n') || '(Sin datos registrados en sub-sección Individual)'
  }

  if (tipoCaso === 'Familiar') {
    const riesgo = Array.isArray(exp.fam_riesgo_items)
      ? (exp.fam_riesgo_items as string[]).map(k => RIESGO_LABELS[k] ?? k).join(', ')
      : ''
    const proteccion = Array.isArray(exp.fam_proteccion_items)
      ? (exp.fam_proteccion_items as string[]).map(k => PROTECCION_LABELS[k] ?? k).join(', ')
      : ''
    return [
      exp.fam_sintomas    ? `Síntomas: ${exp.fam_sintomas}`       : '',
      exp.fam_detonadores ? `Detonadores: ${exp.fam_detonadores}` : '',
      riesgo              ? `Factores de riesgo: ${riesgo}`       : '',
      proteccion          ? `Factores de protección: ${proteccion}` : '',
      Array.isArray(exp.fam_maternaje) && (exp.fam_maternaje as string[]).length > 0
        ? `Maternaje: ${(exp.fam_maternaje as string[]).join(', ')}` : '',
      Array.isArray(exp.fam_paternaje) && (exp.fam_paternaje as string[]).length > 0
        ? `Paternaje: ${(exp.fam_paternaje as string[]).join(', ')}` : '',
      exp.fam_disfunc_tipo ? `Tipo de familia: ${exp.fam_disfunc_tipo}${
        Array.isArray(exp.fam_disfunc_opciones) && (exp.fam_disfunc_opciones as string[]).length > 0
          ? ` — ${(exp.fam_disfunc_opciones as string[]).join(', ')}`
          : ''
      }` : '',
      Array.isArray(exp.fam_tipo_disfunc) && (exp.fam_tipo_disfunc as string[]).length > 0
        ? `Tipo de disfuncionalidad observada: ${(exp.fam_tipo_disfunc as string[]).join('; ')}` : '',
      exp.fam_ciclo_vital         ? `Etapa del ciclo vital: ${exp.fam_ciclo_vital}`          : '',
      exp.fam_ciclo_vital_analisis  ? `Análisis ciclo vital:\n${exp.fam_ciclo_vital_analisis}` : '',
      exp.fam_procesos_analisis     ? `Procesos familiares:\n${exp.fam_procesos_analisis}`    : '',
    ].filter(Boolean).join('\n') || '(Sin datos registrados en sub-sección Familiar)'
  }

  if (tipoCaso === 'Pareja') {
    return '(Sub-sección Pareja en construcción — sin datos disponibles aún)'
  }

  return '(Tipo de caso no reconocido)'
}

// Filtra y formatea las sesiones presenciales seleccionadas (máx. primeras 3)
function buildSesionesPreTexto(
  sesiones: Array<{ session_number: number; session_date: string; session_objetivo: string | null; session_desarrollo: string | null; notes: string | null }>,
  incluidas: number[] | undefined
): string {
  const filtradas = sesiones.filter(s => {
    if (s.session_number > 3) return false
    if (!incluidas || incluidas.length === 0) return false
    return incluidas.includes(s.session_number)
  })
  if (filtradas.length === 0) return ''
  return filtradas.map(s => {
    const partes = [
      `Sesión Presencial ${s.session_number} (${new Date(s.session_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })})`,
      s.session_objetivo   ? `Objetivo: ${s.session_objetivo}`     : '',
      s.session_desarrollo ? `Desarrollo: ${s.session_desarrollo}` : '',
      s.notes              ? `Observaciones: ${s.notes}`           : '',
    ].filter(Boolean)
    return partes.join(' | ')
  }).join('\n')
}

// ── Ruta POST ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { type, patientId, dimensiones, contexto, antecedentes, sintomatologia, prediagnostico, familiar, sesiones_incluidas } = body

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
    const [inPersonRes, patternsRes, expedienteRes] = await Promise.all([
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
        .limit(3),
      supabase
        .from('patient_expediente')
        .select(`
          tipo_caso,
          individual_dimensiones, individual_contexto, individual_antecedentes, individual_sintomatologia,
          fam_sintomas, fam_detonadores, fam_riesgo_items, fam_proteccion_items,
          fam_maternaje, fam_paternaje, fam_disfunc_tipo, fam_disfunc_opciones,
          fam_tipo_disfunc, fam_ciclo_vital, fam_ciclo_vital_analisis, fam_procesos_analisis
        `)
        .eq('therapist_id', user.id)
        .eq('patient_id', patientId)
        .maybeSingle(),
    ])

    const sesionesPresenciales = inPersonRes.data ?? []
    const ultimasAVI = (patternsRes.data ?? []).reverse()
    const expediente = expedienteRes.data as Record<string, unknown> | null
    const tipoCaso: string | null = expediente?.tipo_caso as string | null ?? null

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

    // ── PREDIAGNÓSTICO (5 bloques de información + RAG ConsultoriaFuentes) ───
    if (type === 'prediagnostico') {
      // Bloque 1: Nota Inicial (ya disponible como notaInicial)
      // Bloque 2: Sesiones presenciales 1-3 seleccionadas por el terapeuta
      const sesPreTexto = buildSesionesPreTexto(sesionesPresenciales, sesiones_incluidas)
      // Bloque 3: Últimas 3 sesiones AVI (ultimasAVI ya tiene máx. 3)
      // Bloque 4: Sub-sección según tipo de caso
      const subseccionTexto = buildSubseccionContexto(tipoCaso, expediente)
      // Bloque 5: RAG ConsultoriaFuentes
      const ragQuery = [notaInicial, sesPreTexto, subseccionTexto]
        .filter(Boolean).join('\n\n').slice(0, 6000)
      const fuentesPrediag = await retrieveRelevantChunks(ragQuery)

      const prompt = [
        'Eres supervisor clínico con amplia experiencia en consulta.',
        'Elabora un prediagnóstico clínico del caso basándote EXCLUSIVAMENTE en la información proporcionada.',
        'Devuelve ÚNICAMENTE un objeto JSON con exactamente estas 6 claves.',
        'Máximo 100 palabras por campo. Tu exposición debe ser completa y concluir dentro del límite — no truncues, sintetiza con criterio clínico.',
        'Escribe como lo haría un clínico experimentado: directo, profesional y accesible.',
        'Genera contenido sustantivo en cada campo — si hay poca información explícita, razona a partir del contexto disponible.',
        'Solo usa cadena vacía "" si definitivamente no hay ningún dato para ese campo.',
        '',
        'INSTRUCCIONES ESPECÍFICAS POR CAMPO:',
        '',
        '"impresion" — Impresión del sujeto de evaluación:',
        '  Usa adjetivos y describe la impresión clínica que transmite la persona/familia.',
        '  Incluye: cómo se sintió el terapeuta en la sesión (cómodo, tenso, frustrado, esperanzado, etc.),',
        '  si el consultante estuvo defensivo o abierto, si le faltan límites, si carece de información consciente sobre su situación,',
        '  si visualiza o no sus problemas. Es una impresión subjetiva-clínica, no un diagnóstico.',
        '',
        '"diagnostico" — Diagnóstico presuntivo:',
        '  Nombra las áreas de dificultad observadas: problemas de pareja, comunicación disfuncional, dinámica familiar patológica, etc.',
        '  Indica si encuentras una familia disfuncional, funcional con áreas de mejora, pareja en conflicto, sistema patológico, etc.',
        '  Es un diagnóstico presuntivo — fundamentado pero abierto a revisión.',
        '',
        '"areas_conflicto" — Áreas de conflicto (áreas afectadas):',
        '  Identifica cuáles de las 4 áreas de trabajo de ConsultoriaFuentes están dañadas en este caso:',
        '  (1) Comunicación, (2) Estructura, (3) Gestión emocional, (4) Límites.',
        '  Especifica cuáles están afectadas y en qué grado o manifestación concreta.',
        '',
        '"tipo_problema" — Tipo de problema:',
        '  Clasifica el problema principal: individual, familiar, de pareja o parental.',
        '  Si múltiples áreas están severamente afectadas, señala si se trata de una pareja o familia patológica.',
        '  Puede haber combinaciones (ej. problema individual dentro de dinámica familiar disfuncional).',
        '',
        '"detonadores" — Detonadores:',
        '  Identifica los eventos, situaciones o patrones que detonaron o mantienen el problema actual.',
        '  Pueden ser externos (crisis, pérdida, cambio) o internos (patrones de comunicación, historia familiar, creencias).',
        '  Especifica los detonadores más relevantes para esta pareja, familia o individuo.',
        '',
        '"guia_accion" — Guía de acción o trabajo:',
        '  Indica los instrumentos de evaluación y modelos de intervención a aplicar. Ejemplos posibles:',
        '  Genograma, Mc Master, FODA, Insatisfacción conyugal, u otros instrumentos de ConsultoriaFuentes.',
        '  Especifica también el enfoque: Consejería, Acompañamiento con características clínicas,',
        '  Psicoeducativo, Modelo de intervención específico, Desarrollo grupal, etc.',
        '  Justifica brevemente por qué ese enfoque es el más adecuado para este caso.',
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
        ...(fuentesPrediag ? ['FUENTES CLÍNICAS (ConsultoriaFuentes):', fuentesPrediag, ''] : []),
        '── BLOQUE 1: NOTA INICIAL ──',
        notaInicial,
        ...(sesPreTexto ? ['', '── BLOQUE 2: SESIONES PRESENCIALES SELECCIONADAS ──', sesPreTexto] : ['', '── BLOQUE 2: SESIONES PRESENCIALES ── (ninguna seleccionada por el terapeuta)'] ),
        ...(sesionesAVITexto ? ['', '── BLOQUE 3: SESIONES AVI (últimas 3) ──', sesionesAVITexto] : []),
        '',
        `── BLOQUE 4: SUB-SECCIÓN ${(tipoCaso ?? 'del caso').toUpperCase()} ──`,
        subseccionTexto,
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

    // ── VÍAS DE ACCIÓN — Plan 10 a 12 sesiones (streaming + RAG ConsultoriaFuentes) ──
    if (type === 'vias-accion') {
      const sesPreTexto = buildSesionesPreTexto(sesionesPresenciales, sesiones_incluidas)
      const subseccionTexto = buildSubseccionContexto(tipoCaso, expediente)

      const ragQuery = [notaInicial, sesPreTexto, subseccionTexto]
        .filter(Boolean).join('\n\n').slice(0, 6000)
      const fuentes = await retrieveRelevantChunks(ragQuery)

      const prediagBloque = prediagnostico ? [
        '── PREDIAGNÓSTICO DEL CASO ──',
        `- Impresión del sujeto: ${prediagnostico.impresion || '—'}`,
        `- Diagnóstico presuntivo: ${prediagnostico.diagnostico || '—'}`,
        `- Áreas de conflicto: ${prediagnostico.areas_conflicto || '—'}`,
        `- Tipo de problema: ${prediagnostico.tipo_problema || '—'}`,
        `- Detonadores: ${prediagnostico.detonadores || '—'}`,
        `- Guía de acción: ${prediagnostico.guia_accion || '—'}`,
      ].join('\n') : ''

      const prompt = [
        'Eres supervisor clínico de ConsultoriaFuentes.',
        'Elabora el Plan de Intervención para este caso. El documento tiene DOS PARTES obligatorias.',
        '',
        'RESTRICCIONES ABSOLUTAS — aplican a TODO el documento:',
        '1. Usa EXCLUSIVAMENTE técnicas y enfoques de los documentos de ConsultoriaFuentes proporcionados.',
        '   Si una técnica no aparece en esos documentos, NO la incluyas.',
        '2. No incorpores ninguna práctica, filosofía o enfoque ajeno al contexto católico-cristiano.',
        '3. No incluyas ninguna práctica de la Nueva Era (meditación trascendental, chakras, reiki, astrología, visualizaciones energéticas, etc.) ni ningún sincretismo espiritual.',
        '4. No recurras a información externa a las fuentes. Si las fuentes no cubren algún punto, deja ese apartado más breve, pero no inventes técnicas.',
        '',
        '══ PARTE A — EN LO GENERAL (Motivo de consulta subyacente) ══',
        'Redacta 3 a 4 párrafos en lenguaje coloquial pero formal, clínico y profesional.',
        'Aborda los tres ejes del Motivo de Consulta Subyacente identificado en el Prediagnóstico:',
        '  • QUÉ QUIERO — qué busca realmente el consultante (su deseo o necesidad profunda)',
        '  • CÓMO — de qué manera se propone lograrlo o qué caminos ha intentado',
        '  • PARA QUÉ — el propósito o beneficio que espera obtener al resolver su situación',
        'Escríbelo como lo haría un clínico experimentado hablando a un colega: cercano, preciso, sin tecnicismos innecesarios.',
        'Máximo 180 palabras para esta parte.',
        '',
        '══ PARTE B — EN LO PARTICULAR (Plan de 10 a 12 sesiones) ══',
        'Desarrolla entre 10 y 12 sesiones con acciones específicas derivadas del Prediagnóstico.',
        'Para cada sesión: objetivo clínico concreto, técnica específica de ConsultoriaFuentes, cómo aplicarla con este paciente, resultado esperado.',
        'Nada genérico — todo aplicado al caso particular.',
        '',
        '── FUENTES CLÍNICAS (ConsultoriaFuentes — base exclusiva del plan) ──',
        fuentes || '(Sin fragmentos recuperados — construye el plan únicamente con lo que conozcas de ConsultoriaFuentes)',
        '',
        '── BLOQUE 1: NOTA INICIAL ──',
        notaInicial,
        ...(sesPreTexto ? ['', '── BLOQUE 2: SESIONES PRESENCIALES SELECCIONADAS ──', sesPreTexto] : []),
        ...(sesionesAVITexto ? ['', '── BLOQUE 3: SESIONES AVI (últimas 3) ──', sesionesAVITexto] : []),
        '',
        `── BLOQUE 4: SUB-SECCIÓN ${(tipoCaso ?? 'del caso').toUpperCase()} ──`,
        subseccionTexto,
        ...(prediagBloque ? ['', prediagBloque] : []),
        '',
        'FORMATO EXACTO DE RESPUESTA (no agregues texto fuera de esta estructura):',
        '',
        '**En lo general**',
        '[3-4 párrafos sobre Qué quiero / Cómo / Para qué — máx. 180 palabras]',
        '',
        '**En lo particular**',
        '',
        '**Sesión [N] — [Objetivo principal]**',
        'Técnica: [nombre y autor de ConsultoriaFuentes — una línea]',
        '',
        'Aplicación: [2-3 oraciones concretas de cómo se aplica con este paciente]',
        'Meta: [una oración con el resultado esperado]',
        '',
        '(repite el bloque de sesión para cada una de las 10 a 12 sesiones)',
        '',
        'IMPORTANTE:',
        '- Genera entre 10 y 12 sesiones completas en la Parte B. No te detengas antes de la Sesión 10.',
        '- Máximo 120 palabras por sesión en la Parte B. Sé clínico y directo.',
        '- Entre "Técnica:" y "Aplicación:" deja siempre una línea en blanco.',
        '- Todo en español.',
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
