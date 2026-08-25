// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface InPersonSession {
  sessionNumber: number
  sessionDate:   string
  rawDate:       string
  objetivo:      string
  desarrollo:    string
  notes:         string
}

export interface ExpedienteResumen {
  antecedentes:        string
  sintomatologia:      string
  prediag_impresion:   string
  prediag_diagnostico: string
  prediag_areas:       string
  prediag_tipo:        string
  prediag_detonadores: string
  prediag_guia:        string
}

export type PlanDecision =
  | { tipo: 'sin-prediag' }
  | { tipo: 'prediag-mayor'; viasAccion: string }
  | { tipo: 'prediag-menor'; viasAccion: string; sesionesPost: InPersonSession[] }

// ─────────────────────────────────────────────────────────────────────────────
// Helper: bloque expediente clínico completo (Plan AVI Clínico)
// ─────────────────────────────────────────────────────────────────────────────

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

const DIMENSIONES_LABELS: Record<string, string> = {
  volitiva:   'Volitiva',
  cognicion:  'Cognición',
  afecto:     'Afecto',
  social:     'Social o relacional',
  espiritual: 'Espiritual',
  conductual: 'Conductual',
  fisico:     'Físico',
}

function buildExpedienteClinicoBloque(exp: Record<string, unknown>): string {
  const tipoCaso = exp.tipo_caso as string | null
  const lines: string[] = ['═══ EXPEDIENTE CLÍNICO COMPLETO ═══']

  if (tipoCaso) lines.push(`Tipo de caso: ${tipoCaso}`)

  // ── Datos del asesorado
  const asesoradoPartes = [
    exp.asesorado_nombre       ? `Nombre: ${exp.asesorado_nombre}`       : '',
    exp.asesorado_sexo         ? `Sexo: ${exp.asesorado_sexo}`           : '',
    exp.asesorado_edad         ? `Edad: ${exp.asesorado_edad}`           : '',
    exp.asesorado_estado_civil ? `Estado civil: ${exp.asesorado_estado_civil}` : '',
    exp.asesorado_escolaridad  ? `Escolaridad: ${exp.asesorado_escolaridad}`   : '',
    exp.asesorado_ocupacion    ? `Ocupación: ${exp.asesorado_ocupacion}`       : '',
    exp.asesorado_religion     ? `Religión: ${exp.asesorado_religion}`         : '',
  ].filter(Boolean)
  if (asesoradoPartes.length) lines.push(`Asesorado: ${asesoradoPartes.join(' | ')}`)

  // ── Datos de la pareja
  const parejaPartes = [
    exp.pareja_nombre ? `Nombre: ${exp.pareja_nombre}` : '',
    exp.pareja_sexo   ? `Sexo: ${exp.pareja_sexo}`     : '',
    exp.pareja_edad   ? `Edad: ${exp.pareja_edad}`     : '',
  ].filter(Boolean)
  if (parejaPartes.length) lines.push(`Pareja: ${parejaPartes.join(' | ')}`)

  // ── Hijos
  const hijos = Array.isArray(exp.hijos) ? exp.hijos as Array<Record<string, string>> : []
  const hijosConDatos = hijos.filter(h => h.nombre || h.edad)
  if (hijosConDatos.length) {
    lines.push(`Hijos: ${hijosConDatos.map(h => `${h.nombre || '—'} (${h.edad || '—'})`).join(', ')}`)
  }

  // ── Salud
  const saludPartes = [
    exp.salud_padece_enfermedad === 'Sí' ? 'Padece enfermedad'       : '',
    exp.salud_ayuda_psicologica === 'Sí' ? 'Ha recibido ayuda psicológica previa' : '',
    exp.salud_medicamentos      === 'Sí' ? `Medicamentos: ${exp.salud_medicamentos_cual || 'no especificado'}` : '',
  ].filter(Boolean)
  if (saludPartes.length) lines.push(`Salud: ${saludPartes.join(' | ')}`)

  // ── Sub-sección Individual
  if (tipoCaso === 'Individual') {
    lines.push('\n— Sub-sección Individual —')
    const dims = Array.isArray(exp.individual_dimensiones)
      ? (exp.individual_dimensiones as string[]).map(d => DIMENSIONES_LABELS[d] ?? d).join(', ')
      : ''
    if (dims)                          lines.push(`Dimensiones evolutivas: ${dims}`)
    if (exp.individual_contexto)       lines.push(`Contexto: ${exp.individual_contexto}`)
    if (exp.individual_antecedentes)   lines.push(`Antecedentes:\n${exp.individual_antecedentes}`)
    if (exp.individual_sintomatologia) lines.push(`Sintomatología: ${exp.individual_sintomatologia}`)
  }

  // ── Sub-sección Familiar
  if (tipoCaso === 'Familiar') {
    lines.push('\n— Sub-sección Familiar —')
    if (exp.fam_sintomas)    lines.push(`Síntomas: ${exp.fam_sintomas}`)
    if (exp.fam_detonadores) lines.push(`Detonadores: ${exp.fam_detonadores}`)

    const riesgo = Array.isArray(exp.fam_riesgo_items)
      ? (exp.fam_riesgo_items as string[]).map(k => RIESGO_LABELS[k] ?? k).join(', ')
      : ''
    if (riesgo) lines.push(`Factores de riesgo: ${riesgo}`)

    const proteccion = Array.isArray(exp.fam_proteccion_items)
      ? (exp.fam_proteccion_items as string[]).map(k => PROTECCION_LABELS[k] ?? k).join(', ')
      : ''
    if (proteccion) lines.push(`Factores de protección: ${proteccion}`)

    if (Array.isArray(exp.fam_maternaje) && (exp.fam_maternaje as string[]).length)
      lines.push(`Maternaje: ${(exp.fam_maternaje as string[]).join(', ')}`)
    if (Array.isArray(exp.fam_paternaje) && (exp.fam_paternaje as string[]).length)
      lines.push(`Paternaje: ${(exp.fam_paternaje as string[]).join(', ')}`)
    if (exp.fam_disfunc_tipo)
      lines.push(`Tipo de familia: ${exp.fam_disfunc_tipo}${
        Array.isArray(exp.fam_disfunc_opciones) && (exp.fam_disfunc_opciones as string[]).length
          ? ` — ${(exp.fam_disfunc_opciones as string[]).join(', ')}`
          : ''
      }`)
    if (Array.isArray(exp.fam_tipo_disfunc) && (exp.fam_tipo_disfunc as string[]).length)
      lines.push(`Disfuncionalidad observada: ${(exp.fam_tipo_disfunc as string[]).join('; ')}`)
    if (exp.fam_ciclo_vital)          lines.push(`Etapa del ciclo vital: ${exp.fam_ciclo_vital}`)
    if (exp.fam_ciclo_vital_analisis) lines.push(`Análisis ciclo vital:\n${exp.fam_ciclo_vital_analisis}`)
    if (exp.fam_procesos_analisis)    lines.push(`Procesos familiares:\n${exp.fam_procesos_analisis}`)
  }

  // ── Sub-sección Pareja
  if (tipoCaso === 'Pareja') {
    lines.push('\n— Sub-sección Pareja — (en construcción)')
  }

  // ── Prediagnóstico
  const tienePrediag = !!(
    exp.individual_prediag_impresion || exp.individual_prediag_diagnostico
  )
  if (tienePrediag) {
    lines.push('\n— Prediagnóstico —')
    if (exp.prediag_fecha)                  lines.push(`Fecha: ${exp.prediag_fecha}`)
    if (exp.individual_prediag_impresion)   lines.push(`Impresión: ${exp.individual_prediag_impresion}`)
    if (exp.individual_prediag_diagnostico) lines.push(`Diagnóstico presuntivo: ${exp.individual_prediag_diagnostico}`)
    if (exp.individual_prediag_areas)       lines.push(`Áreas de conflicto: ${exp.individual_prediag_areas}`)
    if (exp.individual_prediag_tipo)        lines.push(`Tipo de problema: ${exp.individual_prediag_tipo}`)
    if (exp.individual_prediag_detonadores) lines.push(`Detonadores: ${exp.individual_prediag_detonadores}`)
    if (exp.individual_prediag_guia)        lines.push(`Guía de acción: ${exp.individual_prediag_guia}`)
  }

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder principal
// ─────────────────────────────────────────────────────────────────────────────

export function buildConsultamePrompt(params: {
  tier: 'esencial' | 'clinico'
  planDecision: PlanDecision
  patientName: string
  initialNote: string
  initialNoteMotivo?: string
  initialNoteSubyacente?: string
  initialNotePremisas?: string
  sessionSummaries: Array<{
    date: string
    rawDate: string
    summary: string
    emotions: string[]
    patterns: string[]
    reformulation: string
    crisisDetected: boolean
  }>
  inPersonSessions?: InPersonSession[]
  fuentes: string
  expediente?: ExpedienteResumen
  expedienteClinico?: Record<string, unknown>
}): string {
  const {
    tier, planDecision,
    patientName, initialNote, initialNoteMotivo, initialNoteSubyacente, initialNotePremisas,
    sessionSummaries, inPersonSessions = [], fuentes, expediente, expedienteClinico,
  } = params

  // ── Unificar sesiones AVI + Presenciales en orden cronológico ────────────
  type EntradaSesion = { rawDate: string; texto: string }

  const entradasAVI: EntradaSesion[] = sessionSummaries.map((s, i) => ({
    rawDate: s.rawDate,
    texto: [
      `--- Sesión AVI ${i + 1} (${s.date}) ---`,
      `Resumen: ${s.summary}`,
      `Emociones predominantes: ${s.emotions.join(', ')}`,
      `Patrones detectados: ${s.patterns.join(', ')}`,
      `Reformulación AVI: "${s.reformulation}"`,
      s.crisisDetected ? '⚠️ ALERTA: posible crisis detectada.' : '',
    ].filter(Boolean).join('\n'),
  }))

  const entradasPresenciales: EntradaSesion[] = inPersonSessions.map(s => ({
    rawDate: s.rawDate,
    texto: [
      `--- Sesión Presencial ${s.sessionNumber} (${s.sessionDate}) ---`,
      s.objetivo    ? `Objetivo: ${s.objetivo}`       : '',
      s.desarrollo  ? `Desarrollo: ${s.desarrollo}`   : '',
      s.notes       ? `Observaciones: ${s.notes}`     : '',
    ].filter(Boolean).join('\n'),
  }))

  const todasLasSesiones = [...entradasAVI, ...entradasPresenciales]
    .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())

  const sesionesUnificadas = todasLasSesiones.length > 0
    ? todasLasSesiones.map(e => e.texto).join('\n\n')
    : 'No hay sesiones registradas aún.'

  const tieneSesiones       = todasLasSesiones.length > 0
  const esAnalisisEvolutivo = tieneSesiones

  // ── Bloque Historia Clínica / Prediagnóstico básico (Esencial) ───────────
  const expedienteBasicoBloque = (() => {
    if (!expediente) return ''
    const tiene = expediente.antecedentes || expediente.prediag_impresion || expediente.prediag_diagnostico
    if (!tiene) return ''
    return [
      '\nHISTORIA CLÍNICA INICIAL Y PREDIAGNÓSTICO:',
      expediente.antecedentes        ? `\nAntecedentes de relevancia:\n${expediente.antecedentes}` : '',
      expediente.sintomatologia      ? `\nSintomatología observada:\n${expediente.sintomatologia}` : '',
      expediente.prediag_impresion   ? `\nImpresión del sujeto: ${expediente.prediag_impresion}` : '',
      expediente.prediag_diagnostico ? `\nDiagnóstico presuntivo: ${expediente.prediag_diagnostico}` : '',
      expediente.prediag_areas       ? `\nÁreas de conflicto: ${expediente.prediag_areas}` : '',
      expediente.prediag_tipo        ? `\nTipo de problema: ${expediente.prediag_tipo}` : '',
      expediente.prediag_detonadores ? `\nDetonadores: ${expediente.prediag_detonadores}` : '',
      expediente.prediag_guia        ? `\nGuía de acción: ${expediente.prediag_guia}` : '',
    ].join('')
  })()

  // ── Bloque Expediente Clínico completo (solo Plan Clínico) ───────────────
  const expedienteClinicoBloque = (tier === 'clinico' && expedienteClinico)
    ? '\n\n' + buildExpedienteClinicoBloque(expedienteClinico)
    : ''

  // ── Instrucciones para PROPUESTA TÉCNICA + PLAN: DIEZ SESIONES ───────────
  function buildPlanInstructions(): string {
    const restricciones = [
      'RESTRICCIONES ABSOLUTAS:',
      '- Sin prácticas ajenas al contexto católico-cristiano.',
      '- Sin Nueva Era (meditación trascendental, chakras, reiki, astrología, visualizaciones energéticas, etc.).',
    ].join('\n')

    // ── Esencial o Clínico sin prediagnóstico: generar desde el análisis ──
    if (tier === 'esencial' || planDecision.tipo === 'sin-prediag') {
      return `
**PROPUESTA TÉCNICA**
Basándote en el análisis que acabas de realizar (Evaluación de Evolución, Resumen, Problemática, Interés, Apegos y Heridas) y en las fuentes de ConsultoriaFuentes, describe la técnica o enfoque que mejor encaja con este caso. Explica por qué esta y no otra, y cómo aplicarla concretamente con ${patientName} y su sistema. Usa frases como "Te propondría...", "Sería valioso explorar...", "Te invitaría a...". No recites el manual — aplícala al caso.
${restricciones}

**PLAN: DIEZ SESIONES**
Sesión por sesión: con quién, qué técnica (nombre y autor de ConsultoriaFuentes), cómo implementarla en este caso concreto. No digas solo "trabajar el apego" — di qué harías, qué preguntarías, qué esperarías lograr. Genera entre 10 y 12 sesiones completas.
${restricciones}`
    }

    // ── Clínico: Prediagnóstico más reciente que última sesión presencial ──
    if (planDecision.tipo === 'prediag-mayor') {
      return `
**PROPUESTA TÉCNICA**
El Plan de Intervención que aparece a continuación ya fue definido en el Expediente para este caso. Basándote en él, redacta la propuesta técnica en 2-3 párrafos: cuál es el enfoque central, por qué es el más adecuado para ${patientName} y cómo acompañar al terapeuta en su implementación. Usa frases como "Te propondría...", "Sería valioso...".

PLAN DE INTERVENCIÓN DEL EXPEDIENTE (fuente de la propuesta):
${planDecision.viasAccion}

**PLAN: DIEZ SESIONES**
Reproduce a continuación el Plan de Intervención del Expediente exactamente como aparece — no lo modifiques, no lo resumas, no lo amplíes:

${planDecision.viasAccion}`
    }

    // ── Clínico: Hay sesiones presenciales posteriores al prediagnóstico ──
    if (planDecision.tipo === 'prediag-menor') {
      const sesPostTexto = planDecision.sesionesPost.length > 0
        ? planDecision.sesionesPost.map(s => [
            `--- Sesión Presencial ${s.sessionNumber} (${s.sessionDate}) ---`,
            s.objetivo   ? `Objetivo: ${s.objetivo}`     : '',
            s.desarrollo ? `Desarrollo: ${s.desarrollo}` : '',
            s.notes      ? `Observaciones: ${s.notes}`   : '',
          ].filter(Boolean).join('\n')).join('\n\n')
        : '(ninguna)'

      return `
**PROPUESTA TÉCNICA**
El Expediente tiene un Prediagnóstico y Plan de Intervención, pero han ocurrido sesiones presenciales con fecha posterior al prediagnóstico. Actualiza la propuesta técnica considerando el avance del caso y las sesiones recientes.

PREDIAGNÓSTICO ORIGINAL (del Expediente):
Impresión: ${expedienteClinico?.individual_prediag_impresion ?? '—'}
Diagnóstico presuntivo: ${expedienteClinico?.individual_prediag_diagnostico ?? '—'}
Áreas de conflicto: ${expedienteClinico?.individual_prediag_areas ?? '—'}
Tipo de problema: ${expedienteClinico?.individual_prediag_tipo ?? '—'}
Detonadores: ${expedienteClinico?.individual_prediag_detonadores ?? '—'}
Guía de acción: ${expedienteClinico?.individual_prediag_guia ?? '—'}

PLAN DE INTERVENCIÓN ORIGINAL (del Expediente):
${planDecision.viasAccion}

SESIONES PRESENCIALES POSTERIORES AL PREDIAGNÓSTICO:
${sesPostTexto}

Basándote en todo lo anterior y en las fuentes clínicas, genera una propuesta técnica actualizada. Usa frases como "Te propondría...", "A la luz de las sesiones recientes...".

**PLAN: DIEZ SESIONES**
Genera un plan de sesiones actualizado que tome como punto de partida el plan original y lo ajuste según el avance real observado en las sesiones posteriores al prediagnóstico. Genera entre 10 y 12 sesiones completas, indicando cuáles retoman el plan original y cuáles son ajustes.

RESTRICCIONES ABSOLUTAS:
- Sin prácticas ajenas al contexto católico-cristiano.
- Sin Nueva Era (meditación trascendental, chakras, reiki, astrología, visualizaciones energéticas, etc.).`
    }

    return ''
  }

  // ── Prompt final ──────────────────────────────────────────────────────────
  return `Eres supervisor clínico de ConsultoriaFuentes. Tu función es orientar al terapeuta con precisión — nada de relleno. Di lo que importa con las palabras justas. Entre más digas con menos, mejor.

Marco teórico que aplicas según lo que pida el caso (no los menciones todos, usa los que realmente aplican):
- Wojtyla / Burgos: personalismo, persona como ser unitario, autodeterminación, amor como don
- Minuchin: holones, límites, jerarquías, triangulaciones, escenificación, mapa estructural
- Virginia Satir: olla de la autoestima, escultura familiar, comunicación no verbal, congruencia
- Bowlby / Ainsworth: apego seguro, ansioso, evitativo, desorganizado; heridas de apego
- Gabor Maté: origen emocional del síntoma, trauma, desconexión mente-cuerpo
- Gottman: cuatro jinetes, intentos de reparación, amistad y propósito compartido
- Buber: relación Yo-Tú, encuentro auténtico vs. uso del otro
- Heridas emocionales: abandono, rechazo, humillación, traición, injusticia
- Técnicas específicas: historieta de soluciones, el globo, línea del tiempo, escultura familiar, entre otras

Tus fuentes de referencia clínica (ConsultoriaFuentes) — úsalas, no las cites de forma genérica:
=== FUENTES ===
${fuentes}
=== FIN DE FUENTES ===

=== CASO ===
Consultante: ${patientName}

NOTA INICIAL DEL TERAPEUTA (punto de partida, independiente de la fecha):

1. DESARROLLO DEL CASO:
${initialNote || '(Sin registrar)'}

2. MOTIVO DE CONSULTA DEL PACIENTE:
${initialNoteMotivo || '(Sin registrar)'}

3. MOTIVO DE CONSULTA SUBYACENTE (observación clínica del terapeuta):
${initialNoteSubyacente || '(Sin registrar)'}

4. PREMISAS ANTE EL MOTIVO DE CONSULTA (hipótesis del terapeuta sobre el origen del problema):
${initialNotePremisas || '(Sin registrar)'}
${tier === 'esencial' ? expedienteBasicoBloque : expedienteClinicoBloque}

SESIONES EN ORDEN CRONOLÓGICO (AVI y presenciales mezcladas por fecha):
${sesionesUnificadas}
=== FIN DEL CASO ===

Entra directo al análisis. Sin presentación, sin "Estimado colega", sin mencionar que eres IA.

---

${esAnalisisEvolutivo ? `**EVALUACIÓN DE EVOLUCIÓN**
¿Avance, estancamiento o retroceso desde la nota inicial hasta hoy? Sé honesto y concreto. Solo lo que muestran los datos.

` : ''}**RESUMEN DEL CASO**
Quién es ${patientName} y cuál es su situación. Solo los datos con valor clínico. Breve y certero.

**PROBLEMÁTICA PRINCIPAL**
El núcleo del conflicto. Lo que lo sostiene. Sin rodeos.

**INTERÉS PARTICULAR DEL CONSULTANTE**
Qué quiere resolver y qué implica clínicamente. Si no hay dato explícito, infiere con base en el caso.

**ANÁLISIS DE APEGOS Y HERIDAS**
Para cada persona relevante del sistema familiar: patrón de apego probable, herida principal, cómo trabajarla. Directo.
${buildPlanInstructions()}

**RECORDATORIO DE TÉCNICAS**
Por cada técnica mencionada en el análisis: qué es, para qué sirve, cómo se aplica. Una entrada por técnica.
Formato: **Nombre (Autor):** explicación.
Ejemplo: **Metáfora de la Olla (Satir):** Representa la autoestima como una olla — llena cuando uno se valora, vacía cuando no. Se trabaja pidiendo al consultante que describa qué tan llena está su olla hoy y qué la ha vaciado, para luego identificar juntos qué la puede ir llenando.

---

Cierra con una frase breve y cálida.

REGLAS:
- Lenguaje coloquial y profesional — como entre colegas, no como ensayo académico
- Concisión por encima de todo: si puedes decirlo en una oración, no uses un párrafo
- Sin relleno, sin meta-comentarios, sin listar autores que no apliquen al caso
- Prosa corrida en resumen, problemática, interés y apegos
- Numerado en el plan de sesiones
- Negritas en el recordatorio
- Todo en español`
}
