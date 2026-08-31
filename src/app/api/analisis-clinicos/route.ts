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

    // ── GENOGRAMA: Descripción de relaciones familiares ───────────────────────
    if (type === 'genograma_descripcion') {
      const { data: rel } = await supabase
        .from('therapist_patients')
        .select('initial_note, initial_note_motivo, initial_note_subyacente')
        .eq('therapist_id', user.id).eq('patient_id', patientId).single()

      if (!rel) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

      const contexto = [
        rel.initial_note       ? `CASO:\n${rel.initial_note}`                          : '',
        rel.initial_note_motivo    ? `MOTIVO DE CONSULTA:\n${rel.initial_note_motivo}` : '',
        rel.initial_note_subyacente ? `MOTIVOS SUBYACENTES:\n${rel.initial_note_subyacente}` : '',
      ].filter(Boolean).join('\n\n') || '(Sin información registrada en la Sesión inicial)'

      const prompt = [
        'Eres un terapeuta clínico. Basándote EXCLUSIVAMENTE en la información de la Sesión inicial proporcionada abajo,',
        'redacta una descripción breve y ordenada de las relaciones familiares mencionadas.',
        '',
        'OBJETIVO: que esta descripción sirva de guía para dibujar el Genograma correctamente.',
        '',
        'ESTRUCTURA DE LA DESCRIPCIÓN:',
        '1. Nombra a cada persona mencionada con su rol (ej. "madre", "padre", "cónyuge", "hijo mayor", etc.).',
        '2. Describe brevemente la relación entre ellos (convivencia, cercanía, conflicto, separación, etc.).',
        '3. Si se mencionan generaciones, organízalas de mayor a menor (abuelos → padres → hijos).',
        '4. Si hay datos relevantes de algún miembro (enfermedad, fallecimiento, separación), inclúyelos.',
        '',
        'RESTRICCIONES:',
        '- Solo usa lo que está explícito en la Sesión inicial. NO inventes ni infiereas personas no mencionadas.',
        '- Lenguaje formal y conciso.',
        '- Si la Sesión inicial no menciona familia, indícalo en una oración.',
        '- Comienza SIEMPRE con el título exacto: "# GENOGRAMA - Descripción de las relaciones familiares"',
        '',
        '── SESIÓN INICIAL ──',
        contexto,
      ].join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = extractText(response.content)
      if (!text) return NextResponse.json({ error: 'No se pudo generar la descripción.' }, { status: 422 })

      return NextResponse.json({ descripcion: text })
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

    // ── DIAGNÓSTICO INTEGRADO ─────────────────────────────────────────────────
    if (type === 'diagnostico_integrado') {
      // 1. Verificar relación terapeuta-paciente + datos del expediente
      const [relRes, expRes] = await Promise.all([
        supabase
          .from('therapist_patients')
          .select('patient_id')
          .eq('therapist_id', user.id).eq('patient_id', patientId).single(),
        supabase
          .from('patient_expediente')
          .select(`tipo_caso, asesorado_nombre,
                   individual_dimensiones, individual_contexto,
                   individual_antecedentes, individual_sintomatologia,
                   individual_prediag_impresion, individual_prediag_diagnostico,
                   individual_prediag_areas, individual_prediag_tipo,
                   individual_prediag_detonadores, individual_prediag_guia,
                   fam_sintomas, fam_detonadores,
                   fam_riesgo_items, fam_proteccion_items,
                   fam_funciones, fam_maternaje, fam_paternaje,
                   fam_disfunc_tipo, fam_disfunc_opciones, fam_tipo_disfunc,
                   fam_ciclo_vital, fam_ciclo_vital_analisis, fam_procesos_analisis`)
          .eq('therapist_id', user.id).eq('patient_id', patientId).maybeSingle(),
      ])

      if (!relRes.data) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

      const exp = expRes.data
      const tipoCaso        = (exp?.tipo_caso as string) ?? 'Individual'
      const nombreAsesorado = exp?.asesorado_nombre ?? ''

      // 2. Construir bloque de datos según tipo de caso
      const DIMENSIONES_MAP: Record<string, string> = {
        volitiva: 'Volitiva — voluntad y toma de decisiones',
        cognicion: 'Cognición — pensamiento, memoria, atención y lenguaje',
        afecto: 'Afecto — vínculos emocionales',
        social: 'Social/Relacional — vínculos interpersonales',
        espiritual: 'Espiritual — sentido y trascendencia',
        conductual: 'Conductual — comportamientos observables',
        fisico: 'Físico — funciones vitales e imagen corporal',
      }

      let datosEspecificos = ''

      if (tipoCaso === 'Individual' && exp) {
        const dims = ((exp.individual_dimensiones as string[]) ?? [])
          .map(id => DIMENSIONES_MAP[id] ?? id).join(', ')
        const lineas = [
          dims              ? `Dimensiones afectadas: ${dims}` : '',
          exp.individual_contexto       ? `Contexto de la problemática: ${exp.individual_contexto}` : '',
          exp.individual_antecedentes   ? `Antecedentes de relevancia: ${exp.individual_antecedentes}` : '',
          exp.individual_sintomatologia ? `Sintomatología observada: ${exp.individual_sintomatologia}` : '',
          exp.individual_prediag_impresion  ? `Impresión clínica: ${exp.individual_prediag_impresion}` : '',
          exp.individual_prediag_diagnostico ? `Diagnóstico: ${exp.individual_prediag_diagnostico}` : '',
          exp.individual_prediag_areas      ? `Áreas de atención: ${exp.individual_prediag_areas}` : '',
          exp.individual_prediag_tipo       ? `Tipo de problemática: ${exp.individual_prediag_tipo}` : '',
          exp.individual_prediag_detonadores ? `Detonadores: ${exp.individual_prediag_detonadores}` : '',
          exp.individual_prediag_guia       ? `Guía de intervención: ${exp.individual_prediag_guia}` : '',
        ].filter(Boolean).join('\n')
        datosEspecificos = lineas || '(Sin datos Individual registrados)'
      } else if (tipoCaso === 'Familiar' && exp) {
        const toStr = (v: unknown) => Array.isArray(v) ? (v as string[]).join(', ') : ''

        // Mapa key → etiqueta (igual que FamiliarTab)
        const FUNC_LABELS: Record<string, string> = {
          necesidades_fisicas:        'Satisfacer necesidades físicas y afectivas',
          socializacion:              'Socialización de los miembros',
          reproduccion:               'Reproducción, incorporación y liberación de sus miembros',
          distribucion_recursos:      'Distribución de recursos y División del trabajo',
          desarrollo_individual:      'Favorecer el desarrollo individual de sus miembros',
          conservacion_orden:         'Conservación del orden (respeto por los límites)',
          integracion_social:         'Integración en el núcleo social',
          supervivencia_hijos:        'Asegurar la supervivencia de sus hijos',
          construccion_adultos:       'Construcción de personas adultas con autoestima y sentido de sí mismos',
          afrontar_retos:             'Aprender a afrontar retos, responsabilidades y compromisos',
          encuentro_intergeneracional:'Encuentro intergeneracional',
          red_apoyo:                  'Red de apoyo social',
        }

        const funcRaw = (exp.fam_funciones && typeof exp.fam_funciones === 'object' && !Array.isArray(exp.fam_funciones))
          ? exp.fam_funciones as Record<string, string>
          : {}

        const funcPresentes   = Object.entries(funcRaw).filter(([, v]) => v === 'Presente')
          .map(([k]) => `    • ${FUNC_LABELS[k] ?? k}`).join('\n')
        const funcNoPresentes = Object.entries(funcRaw).filter(([, v]) => v === 'No presente')
          .map(([k]) => `    • ${FUNC_LABELS[k] ?? k}`).join('\n')
        const funcionesTexto  = (funcPresentes || funcNoPresentes)
          ? [
              funcPresentes   ? `  Presentes:\n${funcPresentes}`    : '',
              funcNoPresentes ? `  No Presentes:\n${funcNoPresentes}` : '',
            ].filter(Boolean).join('\n')
          : ''

        const lineas = [
          exp.fam_sintomas                  ? `Síntomas presentados: ${exp.fam_sintomas}` : '',
          exp.fam_detonadores               ? `Detonadores: ${exp.fam_detonadores}` : '',
          toStr(exp.fam_riesgo_items)       ? `Factores de riesgo: ${toStr(exp.fam_riesgo_items)}` : '',
          toStr(exp.fam_proteccion_items)   ? `Factores de protección: ${toStr(exp.fam_proteccion_items)}` : '',
          funcionesTexto                    ? `Funciones familiares:\n${funcionesTexto}` : '',
          toStr(exp.fam_maternaje)          ? `Maternaje: ${toStr(exp.fam_maternaje)}` : '',
          toStr(exp.fam_paternaje)          ? `Paternaje: ${toStr(exp.fam_paternaje)}` : '',
          exp.fam_disfunc_tipo              ? `Tipo de familia: ${exp.fam_disfunc_tipo}` : '',
          toStr(exp.fam_disfunc_opciones)   ? `Características disfuncionales: ${toStr(exp.fam_disfunc_opciones)}` : '',
          toStr(exp.fam_tipo_disfunc)       ? `Tipo de disfuncionalidad observada: ${toStr(exp.fam_tipo_disfunc)}` : '',
          exp.fam_ciclo_vital               ? `Ciclo vital familiar: ${exp.fam_ciclo_vital}` : '',
          exp.fam_ciclo_vital_analisis      ? `Análisis ciclo vital: ${exp.fam_ciclo_vital_analisis}` : '',
          exp.fam_procesos_analisis         ? `Procesos familiares: ${exp.fam_procesos_analisis}` : '',
        ].filter(Boolean).join('\n')
        datosEspecificos = lineas || '(Sin datos Familiar registrados)'
      } else {
        // Pareja — aún no implementada, usar nota inicial
        datosEspecificos = '(Sección Pareja en construcción — se usa la Nota Inicial como base)'
      }

      // 3. RAG — basado únicamente en los datos de la sub-sección correspondiente
      const fuentes = await retrieveRelevantChunks(datosEspecificos.slice(0, 2000), 10)

      // 4. Prompt corregido
      const prompt = [
        `Eres un terapeuta clínico redactando el "Diagnóstico Integrado" de un caso ${tipoCaso}.`,
        'Trabaja EXCLUSIVAMENTE con los datos del expediente proporcionados abajo.',
        '',
        'ESTRUCTURA REQUERIDA — usa estos encabezados exactos:',
        '',
        `## Diagnóstico Integrado — Caso ${tipoCaso}`,
        '',
        '### Exposición Clínica',
        `Presenta la información registrada en el expediente ${tipoCaso} tal como fue capturada por el terapeuta.`,
        'Organiza cada campo bajo su etiqueta formal correspondiente, de forma ordenada y clara.',
        'NO interpretes, NO parafrasees de forma extensa, NO agregues información.',
        'Omite los campos vacíos. El objetivo es una presentación limpia y formal de los datos.',
        '',
        '### Resumen del Caso',
        'Redacta un resumen-análisis conciso en lenguaje profesional y formal,',
        `como si el terapeuta estuviera presentando el caso ${tipoCaso} a un supervisor o institución.`,
        'NO incluyas historia clínica ni antecedentes generales.',
        `Concéntrate EXCLUSIVAMENTE en los datos de la sub-sección ${tipoCaso} del expediente.`,
        'Analiza esos datos desde el marco teórico de ConsultoríaFuentes (fuentes proporcionadas).',
        'NO salgas de ese marco; fundamenta cada punto de análisis en las fuentes.',
        'Extensión: máximo 3 párrafos — concreto y directo.',
        '',
        ...(fuentes ? ['── FUENTES TEÓRICAS (ConsultoríaFuentes) ──', fuentes, ''] : []),
        '── DATOS DEL EXPEDIENTE ──',
        nombreAsesorado ? `Asesorado/a: ${nombreAsesorado}` : '',
        `Tipo de caso: ${tipoCaso}`,
        '',
        `── SUB-SECCIÓN ${tipoCaso.toUpperCase()} ──`,
        datosEspecificos,
      ].filter(v => v !== undefined && v !== '').join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 3500,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = extractText(response.content)
      console.log('[diagnostico_integrado] stop_reason:', response.stop_reason, '| chars:', text.length)

      if (!text) {
        return NextResponse.json(
          { error: 'No se pudo generar el diagnóstico. Asegúrate de tener datos en la sub-sección correspondiente.' },
          { status: 422 }
        )
      }

      return NextResponse.json({ diagnostico: text })
    }

    // ── INFORMACIÓN DEL PROCESO PSICOLÓGICO ──────────────────────────────────
    if (type === 'proceso_psicologico') {
      const [relRes, sesRes, analysesRes, patternsRes] = await Promise.all([
        supabase
          .from('therapist_patients')
          .select('initial_note_date, initial_note_virtual, initial_note_subyacente, initial_note_motivo')
          .eq('therapist_id', user.id).eq('patient_id', patientId).single(),
        supabase
          .from('therapist_session_notes')
          .select('session_number, session_date, session_objetivo, session_desarrollo, notes')
          .eq('therapist_id', user.id).eq('patient_id', patientId)
          .order('session_date', { ascending: true }),
        supabase
          .from('analyses')
          .select('content, created_at')
          .eq('therapist_id', user.id).eq('patient_id', patientId)
          .order('created_at', { ascending: true })
          .limit(1),
        supabase
          .from('patterns')
          .select('id', { count: 'exact', head: true })
          .eq('patient_id', patientId),
      ])

      if (!relRes.data) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

      const rel          = relRes.data
      const sesiones     = sesRes.data ?? []
      const primerAnalis = analysesRes.data?.[0] ?? null
      const aviCount     = patternsRes.count ?? 0

      // ── Determinar programación de asistencia ────────────────────────────────
      const fechaNota = rel.initial_note_date ? new Date(rel.initial_note_date + 'T12:00:00') : null
      const fecha1Ses = sesiones[0]?.session_date ? new Date(sesiones[0].session_date + 'T12:00:00') : null

      let programacionTexto = '(Sin datos suficientes para determinar la programación)'
      if (fechaNota && fecha1Ses) {
        const diffDias = Math.round((fecha1Ses.getTime() - fechaNota.getTime()) / (1000 * 60 * 60 * 24))
        programacionTexto = diffDias <= 8
          ? `Semanal (${diffDias} días entre Sesión inicial y 1ª sesión de seguimiento).`
          : `Cada dos semanas (${diffDias} días entre Sesión inicial y 1ª sesión de seguimiento).`
      }

      // ── Tipo de acompañamiento ───────────────────────────────────────────────
      const esVirtual    = rel.initial_note_virtual === true
      const esPresencial = sesiones.length > 0
      const tipoAcomp = [
        esPresencial ? 'Presencial' : '',
        esVirtual && aviCount > 0 ? `Virtual (AVI — ${aviCount} sesiones)` : '',
      ].filter(Boolean).join(' y ') || 'Presencial'

      // ── Sesiones presenciales para el prompt ────────────────────────────────
      const sesionesTexto = sesiones.map(s => {
        const fecha = s.session_date
          ? new Date(s.session_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
          : ''
        return [
          `Sesión ${s.session_number} (${fecha}):`,
          s.session_objetivo   ? `  Objetivo: ${s.session_objetivo}`   : '',
          s.session_desarrollo ? `  Desarrollo: ${s.session_desarrollo}` : '',
          s.notes              ? `  Observaciones: ${s.notes}`         : '',
        ].filter(Boolean).join('\n')
      }).join('\n\n')

      const fechaNotaStr = fechaNota
        ? fechaNota.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
        : '(fecha no registrada)'

      // ── RAG ─────────────────────────────────────────────────────────────────
      const ragQuery = [
        rel.initial_note_subyacente ?? '',
        sesiones.slice(-2).map(s => s.session_desarrollo ?? s.notes ?? '').join(' '),
      ].join('\n')
      const fuentes = await retrieveRelevantChunks(ragQuery, 8)

      // ── Prompt ──────────────────────────────────────────────────────────────
      const prompt = [
        'Eres un terapeuta clínico redactando el "Informe de Proceso Psicológico" de un caso.',
        'Redacta en primera persona del plural o como si el terapeuta presentara el caso a un tercero.',
        'Lenguaje formal y profesional. Texto fluido, concreto, no extendido.',
        '',
        'GENERA EL INFORME CON EXACTAMENTE ESTAS 7 SECCIONES (encabezados exactos):',
        '',
        '### 1. Inicio del proceso',
        `Indica desde cuándo asiste (fecha de Sesión inicial: ${fechaNotaStr}) y el tipo de acompañamiento (${tipoAcomp}).`,
        '',
        '### 2. Asistencia y programación',
        `La atención se programó ${programacionTexto}`,
        'Analiza si las sesiones presenciales registradas abajo siguen o no esa programación.',
        'Describe cómo se ha comportado la asistencia real vs. la programada, de forma concisa.',
        '',
        '### 3. Síntomas iniciales y Trastornos observados',
        'Presenta en dos sub-puntos:',
        '- **Síntomas iniciales**: extráelos del campo "Motivos subyacentes" proporcionado abajo.',
        '- **Trastornos observados**: extráelos de la sección "APEGOS Y HERIDAS" del Primer Análisis Caso (proporcionado abajo).',
        '  Si no hay Análisis Caso disponible, indica que aún no se ha generado.',
        '',
        '### 4. Cuadro comparativo de sesiones',
        'Genera ÚNICAMENTE una tabla Markdown con exactamente estas dos columnas — NO escribas texto fuera de la tabla:',
        '| Acciones propuestas (Plan 10 Sesiones) | Acciones realizadas |',
        '|---|---|',
        '',
        'REGLAS DE LA TABLA:',
        '- COLUMNA IZQUIERDA "Acciones propuestas": extrae las sesiones 1 a 12 del "PLAN: DIEZ SESIONES" del Primer Análisis Caso. Sintetiza cada sesión en ≤20 palabras.',
        '- COLUMNA DERECHA "Acciones realizadas": usa las sesiones presenciales EN ORDEN CORRELATIVO (sesión propuesta 1 → sesión realizada 1, sesión propuesta 2 → sesión realizada 2, etc.). Sintetiza en ≤30 palabras. Si no hay sesión realizada para esa posición, escribe "(Pendiente)".',
        '- Si no hay Análisis Caso disponible, escribe una fila con "(Análisis Caso no disponible)" en ambas columnas.',
        '- La tabla debe tener exactamente 2 columnas y tantas filas como sesiones propuestas haya (10-12).',
        '',
        '### 5. Acciones pendientes',
        'Lista muy breve de los temas del Plan 10 Sesiones que aún no han sido trabajados en sesiones presenciales.',
        '',
        '### 6. Conclusiones',
        'Escribe 2-3 oraciones de conclusión clínica, basadas en las fuentes de ConsultoríaFuentes proporcionadas.',
        'Fundamenta en las fuentes. Conciso y específico sobre este caso.',
        '',
        'INSTRUCCIONES FINALES:',
        '- Completa TODAS las secciones (1 a 6) sin excepción — no te detengas antes.',
        '- Todo en español, lenguaje formal y profesional.',
        '- La tabla debe estar bien formateada en Markdown.',
        '- Sé específico sobre este caso; no uses frases genéricas.',
        '',
        ...(fuentes ? ['── FUENTES (ConsultoríaFuentes) ──', fuentes, ''] : []),
        '── DATOS DEL CASO ──',
        `Fecha Sesión inicial: ${fechaNotaStr}`,
        `Tipo de acompañamiento: ${tipoAcomp}`,
        `Programación detectada: ${programacionTexto}`,
        rel.initial_note_motivo    ? `Motivo de consulta: ${rel.initial_note_motivo}`       : '',
        rel.initial_note_subyacente ? `Motivos subyacentes (Síntomas iniciales): ${rel.initial_note_subyacente}` : '',
        '',
        '── SESIONES PRESENCIALES REGISTRADAS ──',
        sesionesTexto || '(Sin sesiones presenciales registradas)',
        '',
        primerAnalis
          ? `── PRIMER ANÁLISIS CASO (${new Date(primerAnalis.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}) ──\n${primerAnalis.content.slice(0, 7000)}`
          : '── PRIMER ANÁLISIS CASO ──\n(No se ha generado ningún Análisis Caso todavía)',
      ].filter(v => v !== undefined && v !== '').join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 7000,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = extractText(response.content)
      console.log('[proceso_psicologico] stop_reason:', response.stop_reason, '| chars:', text.length)

      if (!text) {
        return NextResponse.json(
          { error: 'No se pudo generar el informe. Verifica que haya datos registrados en Sesión inicial y Sesiones.' },
          { status: 422 }
        )
      }

      return NextResponse.json({ proceso: text })
    }

    // ── REPORTE PROCESO: Resumen subsecuente de sesiones ─────────────────────
    if (type === 'proceso_subsecuente') {
      const sesRes = await supabase
        .from('therapist_session_notes')
        .select('session_number, session_date, session_objetivo, session_desarrollo, notes')
        .eq('therapist_id', user.id).eq('patient_id', patientId)
        .order('session_number', { ascending: true })

      const sesiones = sesRes.data ?? []
      if (sesiones.length === 0) {
        return NextResponse.json({ subsecuente: '(Sin sesiones presenciales registradas)' })
      }

      const sesText = sesiones.map(s => {
        const parts = [
          s.session_objetivo   ? `Objetivo: ${s.session_objetivo}`     : '',
          s.session_desarrollo ? `Desarrollo: ${s.session_desarrollo}` : '',
          s.notes              ? `Notas adicionales: ${s.notes}`       : '',
        ].filter(Boolean).join('\n')
        return `Sesión ${s.session_number} (${s.session_date}):\n${parts}`
      }).join('\n\n')

      const prompt = [
        'Eres un terapeuta clínico redactando un informe formal para expediente.',
        'A partir de la información de las sesiones presenciales que se presentan a continuación,',
        'redacta un breve resumen técnico de lo que se trabajó durante el proceso terapéutico.',
        'El resumen debe ser formal, profesional y conciso.',
        'NO uses viñetas ni listas — redacta en párrafos continuos.',
        'NO repitas datos sesión por sesión; sintetiza acciones, avances y aspectos trabajados de manera global.',
        'Máximo 3 párrafos.',
        '',
        '── SESIONES PRESENCIALES ──',
        sesText,
      ].join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = extractText(response.content)
      return NextResponse.json({ subsecuente: text || '(No se pudo generar el resumen)' })
    }

    return NextResponse.json({ error: `Tipo no reconocido: ${type}` }, { status: 400 })

  } catch (error) {
    console.error('[analisis-clinicos] Error general:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
