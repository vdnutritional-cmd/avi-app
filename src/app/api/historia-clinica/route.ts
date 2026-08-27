import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 180

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Extrae sección delimitada del output ──────────────────────────────────────
function extractSection(text: string, key: string): string {
  const re = new RegExp(`\\[${key}\\]([\\s\\S]*?)\\[\\/${key}\\]`, 'i')
  return text.match(re)?.[1]?.trim() ?? ''
}

// ── Extrae el plan de un Análisis Caso ───────────────────────────────────────
function extractPlanFromAnalysis(content: string): string {
  const match = content.match(
    /\*\*PLAN[:\s](?:DIEZ SESIONES|DE INTERVENCIÓN[^*]*)\*\*([\s\S]*?)(?=\n\*\*[A-ZÁÉÍÓÚÑ]|\n---\n|$)/i,
  )
  return match?.[1]?.trim() ?? ''
}

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

// ── Construye el prompt compartido de HC ─────────────────────────────────────
function buildHCPrompt(opts: {
  tipoCaso:         string
  notaInicial:      string
  prediagBloque:    string
  subseccionBloque: string
  presTexto:        string
  aviTexto:         string
}) {
  const { tipoCaso, notaInicial, prediagBloque, subseccionBloque, presTexto, aviTexto } = opts

  return `Eres supervisor clínico. Elabora la Historia Clínica del caso bajo el modelo Personalista bio-psico-social, evaluando y exponiendo los 3 aspectos fundamentales en cada sección:
• Contextual / Social
• Biológico / Físico
• Psicológico / Cognitivo-conductual descriptivo

Genera exactamente 9 secciones. Sé clínico, preciso y directo — evita el relleno. Todo en español.

INSTRUCCIONES POR SECCIÓN:

[MOTIVOS_CONSULTA] — Máx 200 palabras
Lo que el paciente expresa como razón de consulta. Usa sus propias palabras contextualizadas en voz clínica. Toma de los campos 2 "Motivo de consulta del paciente" y "Desarrollo del caso" de la Nota Inicial.

[MOTIVOS_SUBYACENTE] — Máx 200 palabras
La conducta o blanco a trabajar: lo que el terapeuta identifica como el motivo real, en descripción técnica. Toma del campo 3 "Motivo de consulta subyacente" de la Nota Inicial y enriquece con el Prediagnóstico.

[PREMISAS] — Mín 3 premisas numeradas, máx 300 palabras
Hipótesis clínicas sobre el origen del conflicto, conforme a la NOM-004. Cada premisa debe ser verificable en el proceso de consultoría. Formato: "1. ...\n2. ...\n3. ..."

[GENERALIDADES] — Máx 200 palabras
Ciclo evolutivo de la familia o pareja (según tipo de caso: ${tipoCaso}): etapa del ciclo, tareas normativas, tensiones esperadas y cómo este caso se sitúa en ese ciclo.

[CONTEXTO] — Máx 300 palabras
Cómo viven: tiempo juntos, dinámicas cotidianas, ocupaciones, rendimiento escolar de hijos, participación en actividades sociales/educativas. Si es pareja, expón el contexto de cada uno por separado. Incluye desde hace cuánto tiempo llevan así.

[ANTECEDENTES] — Máx 250 palabras
Eventos relevantes que preceden o explican el motivo de consulta: pérdidas, cambios de vida, crisis, diagnósticos médicos, eventos escolares o laborales, historia familiar de origen.

[REFERENTES_ESTRUCTURALES] — Máx 400 palabras
Analiza los siguientes referentes:
1. Jerarquía de roles: autoridad definida o difusa, existencia de hijos parentalizados
2. Estilo de crianza: permisivo, autoritario, negligente, democrático
3. Comunicación: patrones, congruencia, apertura, doble vínculo
4. Poder y toma de decisiones: quién decide, si hay consenso o exclusión
5. Reglas y límites: claridad, rigidez o permeabilidad
${tipoCaso === 'Pareja' ? '6. Complementariedad y simetría de pareja' : ''}

[DINAMICA_RELACIONAL] — Máx 300 palabras
Analiza:
1. Soporte afectivo: cómo se expresan y reciben afecto los miembros
2. Gestión emocional: cómo manejan las emociones individual y sistémicamente
3. Vinculación: calidad del vínculo, tipo de apego, distancia emocional

[SINTOMATOLOGIA] — Máx 400 palabras
Presenta la sintomatología organizada en:
• Individual: lo que falla o presenta cada miembro del sistema (nómbralos)
• Estructura conyugal (si aplica): síntomas del vínculo de pareja
• Por holón estructural (los que apliquen): filial, fraterno, conyugal, parental. Para cada holón indica si hay áreas de oportunidad o no.

FORMATO EXACTO (no agregues texto fuera de los delimitadores):
[MOTIVOS_CONSULTA]
...
[/MOTIVOS_CONSULTA]

[MOTIVOS_SUBYACENTE]
...
[/MOTIVOS_SUBYACENTE]

[PREMISAS]
...
[/PREMISAS]

[GENERALIDADES]
...
[/GENERALIDADES]

[CONTEXTO]
...
[/CONTEXTO]

[ANTECEDENTES]
...
[/ANTECEDENTES]

[REFERENTES_ESTRUCTURALES]
...
[/REFERENTES_ESTRUCTURALES]

[DINAMICA_RELACIONAL]
...
[/DINAMICA_RELACIONAL]

[SINTOMATOLOGIA]
...
[/SINTOMATOLOGIA]

════════════════════ INFORMACIÓN DEL CASO ════════════════════

TIPO DE CASO: ${tipoCaso}

NOTA INICIAL:
${notaInicial}

${prediagBloque ? `PREDIAGNÓSTICO:\n${prediagBloque}` : ''}

${subseccionBloque ? `DATOS SUB-SECCIÓN ${tipoCaso.toUpperCase()}:\n${subseccionBloque}` : ''}

SESIONES PRESENCIALES:
${presTexto || '(Sin sesiones presenciales)'}

SESIONES AVI (todas a la fecha):
${aviTexto || '(Sin sesiones AVI aún)'}`
}

// ── POST — Generar Historia Clínica (no guarda en DB) ────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { patientId, type } = await request.json() as { patientId: string; type: 'original' | 'actualizada' }
    if (!patientId || !type) return NextResponse.json({ error: 'patientId y type requeridos' }, { status: 400 })

    // ── Cargar datos base ─────────────────────────────────────────────────────
    const [relationRes, expedienteRes, aviRes, todosPresencialRes, analysisRes] = await Promise.all([
      supabase
        .from('therapist_patients')
        .select('initial_note, initial_note_motivo, initial_note_subyacente, initial_note_premisas')
        .eq('therapist_id', user.id).eq('patient_id', patientId).single(),

      supabase
        .from('patient_expediente')
        .select('*')
        .eq('therapist_id', user.id).eq('patient_id', patientId).maybeSingle(),

      supabase
        .from('patterns')
        .select('summary, emotional_patterns, predominant_emotions, crisis_detected, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: true }),

      supabase
        .from('therapist_session_notes')
        .select('session_number, session_date, session_objetivo, session_desarrollo, notes')
        .eq('therapist_id', user.id).eq('patient_id', patientId)
        .order('session_number', { ascending: true }),

      supabase
        .from('analyses')
        .select('content, created_at')
        .eq('therapist_id', user.id).eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle(),
    ])

    if (!relationRes.data) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    const rel = relationRes.data
    const exp = expedienteRes.data as Record<string, unknown> | null
    const tipoCaso = (exp?.tipo_caso as string) ?? 'No definido'
    const todosPresenciales = todosPresencialRes.data ?? []
    const todasAVI = aviRes.data ?? []

    // ── Nota Inicial ─────────────────────────────────────────────────────────
    const notaInicial = [
      `1. DESARROLLO DEL CASO:\n${rel.initial_note || '(Sin registrar)'}`,
      `2. MOTIVO DE CONSULTA DEL PACIENTE:\n${rel.initial_note_motivo || '(Sin registrar)'}`,
      `3. MOTIVO DE CONSULTA SUBYACENTE:\n${rel.initial_note_subyacente || '(Sin registrar)'}`,
      `4. PREMISAS ANTE EL MOTIVO DE CONSULTA:\n${rel.initial_note_premisas || '(Sin registrar)'}`,
    ].join('\n\n')

    // ── Helper: formatear sesiones presenciales ───────────────────────────────
    function formatSesiones(sesiones: typeof todosPresenciales): string {
      return sesiones.map(s => [
        `Sesión Presencial ${s.session_number} (${new Date(s.session_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })})`,
        s.session_objetivo   ? `Objetivo: ${s.session_objetivo}`     : '',
        s.session_desarrollo ? `Desarrollo: ${s.session_desarrollo}` : '',
        s.notes              ? `Observaciones: ${s.notes}`           : '',
      ].filter(Boolean).join(' | ')).join('\n')
    }

    // ── Helper: formatear sesiones AVI ───────────────────────────────────────
    function formatAVI(avi: typeof todasAVI): string {
      return avi.map((p, i) => [
        `Sesión AVI ${i + 1} (${new Date(p.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })})`,
        `Resumen: ${p.summary}`,
        `Emociones: ${(p.predominant_emotions ?? []).join(', ')}`,
        `Patrones: ${(p.emotional_patterns ?? []).join(', ')}`,
        p.crisis_detected ? '⚠️ Crisis detectada.' : '',
      ].filter(Boolean).join(' | ')).join('\n')
    }

    // ── Helper: bloque sub-sección ────────────────────────────────────────────
    function buildSubseccion(): string {
      if (!exp) return ''
      if (tipoCaso === 'Individual') {
        const dims = Array.isArray(exp.individual_dimensiones) ? (exp.individual_dimensiones as string[]).join(', ') : ''
        return [
          dims                          ? `Dimensiones evolutivas: ${dims}`                            : '',
          exp.individual_contexto       ? `Contexto: ${exp.individual_contexto}`                        : '',
          exp.individual_antecedentes   ? `Antecedentes:\n${exp.individual_antecedentes}`               : '',
          exp.individual_sintomatologia ? `Sintomatología: ${exp.individual_sintomatologia}`            : '',
        ].filter(Boolean).join('\n')
      }
      if (tipoCaso === 'Familiar') {
        const riesgo = Array.isArray(exp.fam_riesgo_items)
          ? (exp.fam_riesgo_items as string[]).map(k => RIESGO_LABELS[k] ?? k).join(', ') : ''
        const proteccion = Array.isArray(exp.fam_proteccion_items)
          ? (exp.fam_proteccion_items as string[]).map(k => PROTECCION_LABELS[k] ?? k).join(', ') : ''
        return [
          exp.fam_sintomas          ? `Síntomas: ${exp.fam_sintomas}`           : '',
          exp.fam_detonadores       ? `Detonadores: ${exp.fam_detonadores}`     : '',
          riesgo                    ? `Factores de riesgo: ${riesgo}`           : '',
          proteccion                ? `Factores de protección: ${proteccion}`   : '',
          exp.fam_ciclo_vital       ? `Ciclo vital: ${exp.fam_ciclo_vital}`     : '',
          exp.fam_ciclo_vital_analisis ? `Análisis ciclo vital:\n${exp.fam_ciclo_vital_analisis}` : '',
          exp.fam_procesos_analisis    ? `Procesos familiares:\n${exp.fam_procesos_analisis}`    : '',
        ].filter(Boolean).join('\n')
      }
      return ''
    }

    let prediagBloque = ''
    let planIntervencion = ''
    let sesionesParaHC: typeof todosPresenciales = []

    // ── Lógica por tipo ───────────────────────────────────────────────────────
    if (type === 'original') {
      // Prediagnóstico: usar snapshot original
      const orig = exp?.individual_prediag_original as Record<string, string> | null
      if (orig) {
        prediagBloque = [
          orig.impresion   ? `Impresión: ${orig.impresion}`         : '',
          orig.diagnostico ? `Diagnóstico presuntivo: ${orig.diagnostico}` : '',
          orig.areas       ? `Áreas de conflicto: ${orig.areas}`    : '',
          orig.tipo        ? `Tipo de problema: ${orig.tipo}`       : '',
          orig.detonadores ? `Detonadores: ${orig.detonadores}`     : '',
          orig.guia        ? `Guía de acción: ${orig.guia}`         : '',
        ].filter(Boolean).join('\n')
      }

      // Plan: usar vias_original
      planIntervencion = (exp?.individual_vias_original as string) ?? ''

      // Sesiones: solo las incluidas en el prediagnóstico original
      const incluidas = (exp?.prediag_sesiones_incluidas as number[] | null) ?? []
      // Fallback: si no hay registro, usar sesiones 1-3 disponibles
      sesionesParaHC = incluidas.length > 0
        ? todosPresenciales.filter(s => incluidas.includes(s.session_number))
        : todosPresenciales.filter(s => s.session_number <= 3)

    } else {
      // Actualizada: prediag actual vs análisis caso (el más reciente)
      const prediagFecha   = exp?.prediag_fecha as string | null
      const analysisDate   = analysisRes.data?.created_at as string | null
      const analysisContent = analysisRes.data?.content as string | null

      // ¿Cuál es más reciente?
      const usarAnalisis = !!(analysisDate && prediagFecha && new Date(analysisDate) > new Date(prediagFecha + 'T00:00:00'))
        || (!prediagFecha && !!analysisDate)

      if (usarAnalisis && analysisContent) {
        // Extraer prediag del análisis (secciones que contienen datos clínicos)
        prediagBloque = `(Basado en el Análisis Caso más reciente — ${new Date(analysisDate!).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })})`
        // Para el plan: usar el plan del análisis caso
        planIntervencion = extractPlanFromAnalysis(analysisContent)
      } else {
        // Usar prediag actualizado (actual)
        prediagBloque = [
          exp?.individual_prediag_impresion   ? `Impresión: ${exp.individual_prediag_impresion}`         : '',
          exp?.individual_prediag_diagnostico ? `Diagnóstico presuntivo: ${exp.individual_prediag_diagnostico}` : '',
          exp?.individual_prediag_areas       ? `Áreas de conflicto: ${exp.individual_prediag_areas}`    : '',
          exp?.individual_prediag_tipo        ? `Tipo de problema: ${exp.individual_prediag_tipo}`       : '',
          exp?.individual_prediag_detonadores ? `Detonadores: ${exp.individual_prediag_detonadores}`     : '',
          exp?.individual_prediag_guia        ? `Guía de acción: ${exp.individual_prediag_guia}`         : '',
        ].filter(Boolean).join('\n')
      }

      // Plan: el más reciente entre vias_accion (prediag actualizado) y plan del análisis
      if (!planIntervencion) {
        const viasActual = exp?.individual_vias_accion as string | null
        const planAnalisis = analysisContent ? extractPlanFromAnalysis(analysisContent) : ''

        if (viasActual && analysisDate && prediagFecha) {
          planIntervencion = new Date(analysisDate) > new Date(prediagFecha + 'T00:00:00')
            ? (planAnalisis || viasActual)
            : viasActual
        } else {
          planIntervencion = viasActual || planAnalisis || ''
        }
      }

      // Sesiones: TODAS las presenciales
      sesionesParaHC = todosPresenciales
    }

    // ── Construir y llamar al modelo ──────────────────────────────────────────
    const prompt = buildHCPrompt({
      tipoCaso,
      notaInicial,
      prediagBloque,
      subseccionBloque: buildSubseccion(),
      presTexto:        formatSesiones(sesionesParaHC),
      aviTexto:         formatAVI(todasAVI),
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    console.log('[historia-clinica] type:', type, '| stop_reason:', response.stop_reason, '| chars:', raw.length)

    if (!raw) return NextResponse.json({ error: 'El modelo no generó contenido. Intenta de nuevo.' }, { status: 422 })

    const sections = {
      motivos_consulta:         extractSection(raw, 'MOTIVOS_CONSULTA'),
      motivos_subyacente:       extractSection(raw, 'MOTIVOS_SUBYACENTE'),
      premisas:                 extractSection(raw, 'PREMISAS'),
      generalidades:            extractSection(raw, 'GENERALIDADES'),
      contexto:                 extractSection(raw, 'CONTEXTO'),
      antecedentes:             extractSection(raw, 'ANTECEDENTES'),
      referentes_estructurales: extractSection(raw, 'REFERENTES_ESTRUCTURALES'),
      dinamica_relacional:      extractSection(raw, 'DINAMICA_RELACIONAL'),
      sintomatologia:           extractSection(raw, 'SINTOMATOLOGIA'),
      plan_intervencion:        planIntervencion,
    }

    return NextResponse.json({ sections })

  } catch (error) {
    console.error('[historia-clinica POST] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── PATCH — Guardar Historia Clínica en DB ───────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { patientId, type, sections } = await request.json() as {
      patientId: string
      type: 'original' | 'actualizada'
      sections: Record<string, string>
    }

    if (!patientId || !type || !sections) {
      return NextResponse.json({ error: 'patientId, type y sections requeridos' }, { status: 400 })
    }

    if (type === 'original') {
      // Verificar que no exista ya una HC original (inmutable)
      const { data: existing } = await supabase
        .from('patient_expediente')
        .select('hc_original')
        .eq('therapist_id', user.id)
        .eq('patient_id', patientId)
        .maybeSingle()

      if (existing?.hc_original) {
        return NextResponse.json({ error: 'La Historia Clínica Original ya existe y no puede modificarse.' }, { status: 409 })
      }

      const { error } = await supabase.from('patient_expediente').upsert({
        therapist_id: user.id,
        patient_id:   patientId,
        hc_original:  sections,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'therapist_id,patient_id' })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    } else {
      // HC Actualizada: siempre sobrescribe
      const { error } = await supabase.from('patient_expediente').upsert({
        therapist_id:   user.id,
        patient_id:     patientId,
        hc_actualizada: sections,
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'therapist_id,patient_id' })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[historia-clinica PATCH] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
