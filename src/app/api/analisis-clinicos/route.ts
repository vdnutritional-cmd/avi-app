import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { retrieveChunksFromBooks, retrieveRelevantChunks } from '@/lib/rag/retrieve-chunks'

export const maxDuration = 120

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function extractText(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text' && block.text.trim().length > 0) {
      return block.text.trim()
    }
  }
  return ''
}

// Factores McMaster (para calcular en el servidor también)
const FACTORES_MC = [
  { id: 1, label: 'Factor 1. Involucramiento afectivo funcional',    vmin: 17, vmax: 85, invertido: false },
  { id: 2, label: 'Factor 2. Involucramiento afectivo disfuncional', vmin: 11, vmax: 55, invertido: true  },
  { id: 3, label: 'Factor 3. Patrones de comunicación disfuncional', vmin:  4, vmax: 20, invertido: true  },
  { id: 4, label: 'Factor 4. Patrones de comunicación funcional',    vmin:  3, vmax: 15, invertido: false },
  { id: 5, label: 'Factor 5. Resolución de problemas',              vmin:  3, vmax: 15, invertido: false },
  { id: 6, label: 'Factor 6. Patrones de control de conducta',      vmin:  2, vmax: 10, invertido: false },
]

function rd1(n: number) { return Math.round(n * 10) / 10 }

function calcFactor(vdStr: string | number | null, vmin: number, vmax: number, invertido: boolean) {
  if (vdStr === null || vdStr === '') return null
  const vd = typeof vdStr === 'number' ? vdStr : parseFloat(vdStr)
  if (isNaN(vd) || vd < vmin || vd > vmax) return null
  const base      = rd1((vd - vmin) / (vmax - vmin) * 100)
  const funcional = invertido ? rd1(100 - base) : base
  return { funcional, disfuncional: rd1(100 - funcional) }
}

// ── POST /api/analisis-clinicos ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { type, patientId, valores, resultados } = body

    if (!type || !patientId) {
      return NextResponse.json({ error: 'Faltan parámetros: type y patientId' }, { status: 400 })
    }

    // ── MCMASTER: Interpretación con RAG ──────────────────────────────────────
    if (type === 'mcmaster_interpretacion') {
      // 1. Nota inicial del paciente
      const { data: relation } = await supabase
        .from('therapist_patients')
        .select('initial_note, initial_note_motivo, initial_note_subyacente, initial_note_premisas')
        .eq('therapist_id', user.id)
        .eq('patient_id', patientId)
        .single()

      if (!relation) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

      const notaInicial = [
        relation.initial_note           ? `DESARROLLO DEL CASO:\n${relation.initial_note}`                         : '',
        relation.initial_note_motivo    ? `MOTIVO DE CONSULTA:\n${relation.initial_note_motivo}`                   : '',
        relation.initial_note_subyacente ? `MOTIVO SUBYACENTE:\n${relation.initial_note_subyacente}`              : '',
        relation.initial_note_premisas  ? `PREMISAS CLÍNICAS:\n${relation.initial_note_premisas}`                  : '',
      ].filter(Boolean).join('\n\n') || '(Sin nota inicial registrada)'

      // 2. Datos expediente para contexto adicional
      const { data: expediente } = await supabase
        .from('patient_expediente')
        .select('tipo_caso, asesorado_nombre')
        .eq('therapist_id', user.id)
        .eq('patient_id', patientId)
        .maybeSingle()

      const nombreAsesorado = expediente?.asesorado_nombre ?? ''
      const tipoCaso = expediente?.tipo_caso ?? ''

      // 3. RAG: recuperar chunks del Modelo McMaster
      const ragQuery = [
        notaInicial.slice(0, 3000),
        valores ? `Valores McMaster obtenidos: ${JSON.stringify(valores)}` : '',
      ].filter(Boolean).join('\n\n')

      const fuentes = await retrieveChunksFromBooks(
        ragQuery,
        ['Modelo McMaster Familias'],
        8
      )

      // 4. Formatear resultados para el prompt
      const FACTORES_LABELS: Record<number, string> = {
        1: 'Involucramiento afectivo funcional',
        2: 'Involucramiento afectivo disfuncional',
        3: 'Patrones de comunicación disfuncional',
        4: 'Patrones de comunicación funcional',
        5: 'Resolución de problemas',
        6: 'Patrones de control de conducta',
      }

      const factoresTexto = resultados
        ? Object.entries(resultados as Record<string, { funcional: number; disfuncional: number } | null>)
            .filter(([, v]) => v !== null)
            .map(([id, v]) => {
              const label = FACTORES_LABELS[Number(id)] ?? `Factor ${id}`
              return `  - ${label}: Funcional ${(v as { funcional: number; disfuncional: number }).funcional}% / Disfuncional ${(v as { funcional: number; disfuncional: number }).disfuncional}%`
            })
            .join('\n')
        : '(Sin resultados calculados)'

      const efResumen = resultados
        ? (() => {
            const vals = Object.values(resultados as Record<string, { funcional: number; disfuncional: number } | null>)
              .filter(Boolean) as { funcional: number; disfuncional: number }[]
            if (vals.length === 0) return ''
            const rf = vals.reduce((s, v) => s + v.funcional, 0) / vals.length
            const rd = vals.reduce((s, v) => s + v.disfuncional, 0) / vals.length
            const eff = (rf + rd) / 2
            return `RF promedio: ${rf.toFixed(1)}% | RD promedio: ${rd.toFixed(1)}% | EFF: ${eff.toFixed(1)}% → ${eff >= 60 ? 'Funcional' : 'Disfuncional'}`
          })()
        : ''

      // 5. Construir prompt
      const prompt = [
        'Eres supervisor clínico especializado en terapia familiar con amplio conocimiento del Modelo McMaster.',
        'Redacta una interpretación clínica de los resultados del Análisis McMaster para este caso.',
        '',
        'INSTRUCCIONES:',
        '- Interpreta cada factor con criterio clínico, no solo como número.',
        '- Señala las áreas de fortaleza y las áreas de riesgo o disfuncionalidad.',
        '- Relaciona los resultados con el contexto del caso (nota inicial).',
        '- Proporciona 2-3 sugerencias de intervención concretas fundamentadas en el Modelo McMaster.',
        '- Lenguaje profesional, directo y clínico. Extiéndete lo necesario para cubrir todos los factores.',
        '- Responde directamente con la interpretación, sin título ni encabezado.',
        '',
        ...(fuentes ? ['FUENTE CLÍNICA (Modelo McMaster de Familias):', fuentes, ''] : []),
        '── DATOS DEL CASO ──',
        nombreAsesorado ? `Asesorado: ${nombreAsesorado}` : '',
        tipoCaso        ? `Tipo de caso: ${tipoCaso}`     : '',
        '',
        '── NOTA INICIAL ──',
        notaInicial,
        '',
        '── RESULTADOS MCMASTER ──',
        factoresTexto,
        ...(efResumen ? ['', efResumen] : []),
      ].filter(v => v !== undefined).join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = extractText(response.content)
      console.log('[mcmaster_interpretacion] stop_reason:', response.stop_reason, '| chars:', text.length)

      if (!text) {
        return NextResponse.json(
          { error: 'El modelo no generó contenido. Verifica que haya información clínica disponible.' },
          { status: 422 }
        )
      }

      return NextResponse.json({ interpretacion: text })
    }

    // ── CONCLUSIONES: Evaluación cuantitativa + cualitativa ───────────────────
    if (type === 'conclusiones') {
      // 1. Datos del paciente
      const [relationRes, expedienteRes, sesionesRes] = await Promise.all([
        supabase
          .from('therapist_patients')
          .select('initial_note, initial_note_motivo, initial_note_subyacente, initial_note_premisas')
          .eq('therapist_id', user.id)
          .eq('patient_id', patientId)
          .single(),
        supabase
          .from('patient_expediente')
          .select(`asesorado_nombre, tipo_caso,
                   individual_prediag_impresion, individual_prediag_diagnostico,
                   ac_apartados_visibles,
                   ac_genograma_interpretacion,
                   ac_mcmaster_valores, ac_mcmaster_interpretacion,
                   ac_foda_interpretacion`)
          .eq('therapist_id', user.id)
          .eq('patient_id', patientId)
          .maybeSingle(),
        supabase
          .from('therapist_session_notes')
          .select('session_number, session_date, notes, session_objetivo, session_desarrollo')
          .eq('therapist_id', user.id)
          .eq('patient_id', patientId)
          .order('session_number', { ascending: false })
          .limit(3),
      ])

      const relation   = relationRes.data
      const expediente = expedienteRes.data   // puede ser null si aún no hay expediente

      if (!relation) {
        return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
      }

      const visibles: string[] = expediente?.ac_apartados_visibles ?? ['genograma', 'mcmaster', 'foda']
      const nombreAsesorado    = expediente?.asesorado_nombre ?? ''
      const tipoCaso           = expediente?.tipo_caso ?? ''

      // ── 2. Resumen cuantitativo McMaster ──────────────────
      let cuantitativoTexto = ''
      let mcResumen = ''

      if (visibles.includes('mcmaster') && expediente?.ac_mcmaster_valores) {
        const vals = expediente.ac_mcmaster_valores as Record<string, number | null>
        const mcRows = FACTORES_MC.map(f => {
          const vd = vals[`vd${f.id}`]
          const res = vd !== null && vd !== undefined ? calcFactor(vd, f.vmin, f.vmax, f.invertido) : null
          return { label: f.label, vd, res }
        })
        const validRows = mcRows.filter(r => r.res !== null)

        if (validRows.length > 0) {
          const rf  = rd1(validRows.reduce((s, r) => s + r.res!.funcional,    0) / validRows.length)
          const rd  = rd1(validRows.reduce((s, r) => s + r.res!.disfuncional, 0) / validRows.length)
          const eff = rd1((rf + rd) / 2)
          const conclusion = eff >= 60 ? 'Funcional' : 'Disfuncional'

          const factoresLineas = mcRows.map(r =>
            r.res
              ? `  • ${r.label}: Funcional ${r.res.funcional}% / Disfuncional ${r.res.disfuncional}%`
              : `  • ${r.label}: sin dato`
          ).join('\n')

          mcResumen = [
            'ANÁLISIS McMASTER (Modelo de Funcionalidad Familiar):',
            factoresLineas,
            `  RF (promedio funcional): ${rf}%`,
            `  RD (promedio disfuncional): ${rd}%`,
            `  EFF = (RF+RD)/2 = ${eff}% → FAMILIA ${conclusion.toUpperCase()}`,
          ].join('\n')

          cuantitativoTexto = mcResumen
        }
      }

      // ── 3. Contexto clínico completo ──────────────────────
      const notaInicial = [
        relation.initial_note           ? `CASO CLÍNICO:\n${relation.initial_note}`          : '',
        relation.initial_note_motivo    ? `MOTIVO DE CONSULTA:\n${relation.initial_note_motivo}` : '',
        relation.initial_note_subyacente ? `MOTIVO SUBYACENTE:\n${relation.initial_note_subyacente}` : '',
        relation.initial_note_premisas  ? `PREMISAS:\n${relation.initial_note_premisas}`     : '',
      ].filter(Boolean).join('\n\n') || '(Sin nota inicial)'

      const interpretaciones: string[] = []
      if (visibles.includes('genograma') && expediente?.ac_genograma_interpretacion?.trim()) {
        interpretaciones.push(`GENOGRAMA — Interpretación del terapeuta:\n${expediente.ac_genograma_interpretacion}`)
      }
      if (visibles.includes('mcmaster') && expediente?.ac_mcmaster_interpretacion?.trim()) {
        interpretaciones.push(`McMASTER — Interpretación del terapeuta:\n${expediente.ac_mcmaster_interpretacion}`)
      }
      if (visibles.includes('foda') && expediente?.ac_foda_interpretacion?.trim()) {
        interpretaciones.push(`FODA — Interpretación del terapeuta:\n${expediente.ac_foda_interpretacion}`)
      }

      const sesionesTexto = (sesionesRes.data ?? [])
        .map(s => `  Sesión ${s.session_number}: ${s.notes ?? s.session_desarrollo ?? ''}`.slice(0, 300))
        .join('\n')

      // ── 4. RAG: fuentes amplias de ConsultoríaFuentes ────
      const ragQuery = [
        notaInicial.slice(0, 2000),
        cuantitativoTexto.slice(0, 500),
        interpretaciones.join('\n\n').slice(0, 2000),
      ].filter(Boolean).join('\n\n')

      const fuentes = await retrieveRelevantChunks(ragQuery, 12)

      // ── 5. Prompt de conclusiones ─────────────────────────
      const LABEL: Record<string, string> = { genograma: 'Genograma', mcmaster: 'McMaster', foda: 'FODA' }
      const analisisActivos = visibles.map(id => LABEL[id] ?? id).join(', ')

      // Descripciones dinámicas por sección según qué está activo
      const descCuantitativa = visibles.includes('mcmaster') && cuantitativoTexto
        ? 'Presenta e interpreta con criterio clínico los resultados numéricos del Análisis McMaster (factores, RF%, RD%, EFF% y conclusión Funcional/Disfuncional). No repitas los números sin interpretarlos.'
        : 'No hay datos cuantitativos disponibles para los análisis seleccionados. Indícalo en una sola oración y omite esta sección.'

      const descCualitativa = interpretaciones.length > 0
        ? `Redacta una narrativa clínica coherente basada EXCLUSIVAMENTE en las interpretaciones de los análisis seleccionados (${analisisActivos}) que se proporcionan más abajo. Señala hallazgos, recursos y áreas de atención del caso.`
        : `No hay interpretaciones registradas para los análisis seleccionados (${analisisActivos}). Indica brevemente que el terapeuta aún no ha registrado interpretación.`

      const prompt = [
        'Eres un supervisor clínico con amplio dominio en terapia familiar, sistémica y de pareja.',
        '',
        '══ ANÁLISIS SELECCIONADOS (ÚNICOS QUE DEBES ANALIZAR) ══',
        analisisActivos,
        '',
        'RESTRICCIÓN ABSOLUTA: Analiza SOLAMENTE los análisis listados arriba.',
        'PROHIBIDO mencionar, inferir o analizar cualquier análisis que NO esté en esa lista,',
        'aunque cuentes con información clínica general del caso que podría sugerir otros análisis.',
        'El contexto del caso (nota inicial, sesiones) es solo para dar sentido clínico a los',
        'análisis seleccionados — no autoriza analizar dimensiones adicionales.',
        '',
        'ESTRUCTURA REQUERIDA — usa estos encabezados exactos:',
        '',
        '## 1. Evaluación Cuantitativa',
        descCuantitativa,
        '',
        '## 2. Evaluación Cualitativa',
        descCualitativa,
        '',
        '## 3. Conclusión Clínica Integradora',
        `Síntesis de 2-3 párrafos integrando únicamente ${analisisActivos}. Incluye estado actual del caso, pronóstico y líneas prioritarias de intervención fundamentadas en los hallazgos de los análisis seleccionados.`,
        '',
        'INSTRUCCIONES ADICIONALES:',
        '- Lenguaje profesional, clínico y directo.',
        '- Sé específico sobre este caso, no genérico.',
        '- Si un análisis seleccionado no tiene datos suficientes, indícalo brevemente en esa sección.',
        '',
        ...(fuentes ? ['── FUENTES TEÓRICAS (ConsultoríaFuentes) ──', fuentes, ''] : []),
        '── CONTEXTO DEL CASO (solo para dar sentido clínico, NO para analizar otras dimensiones) ──',
        nombreAsesorado ? `Asesorado/a: ${nombreAsesorado}` : '',
        tipoCaso        ? `Tipo de caso: ${tipoCaso}`       : '',
        expediente?.individual_prediag_impresion ? `Impresión clínica: ${(expediente.individual_prediag_impresion as string).slice(0, 400)}` : '',
        expediente?.individual_prediag_diagnostico ? `Diagnóstico: ${(expediente.individual_prediag_diagnostico as string).slice(0, 300)}` : '',
        '',
        '── NOTA INICIAL ──',
        notaInicial,
        '',
        ...(cuantitativoTexto ? [`── DATOS CUANTITATIVOS (${analisisActivos}) ──`, cuantitativoTexto, ''] : []),
        ...(interpretaciones.length ? [`── INTERPRETACIONES DEL TERAPEUTA (${analisisActivos}) ──`, ...interpretaciones, ''] : []),
        ...(sesionesTexto ? ['── ÚLTIMAS SESIONES PRESENCIALES (contexto, no adicionar análisis) ──', sesionesTexto] : []),
      ].filter(v => v !== undefined && v !== '').join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 3500,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = extractText(response.content)
      console.log('[conclusiones] stop_reason:', response.stop_reason, '| chars:', text.length)

      if (!text) {
        return NextResponse.json(
          { error: 'No se pudo generar el análisis. Asegúrate de que al menos un análisis tenga datos registrados.' },
          { status: 422 }
        )
      }

      return NextResponse.json({ conclusiones: text, cuantitativo: cuantitativoTexto })
    }

    return NextResponse.json({ error: `Tipo no reconocido: ${type}` }, { status: 400 })

  } catch (error) {
    console.error('[analisis-clinicos] Error general:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
