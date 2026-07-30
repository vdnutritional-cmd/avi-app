export interface InPersonSession {
  sessionNumber: number
  sessionDate: string
  rawDate: string
  objetivo: string       // Objetivo de la sesión
  desarrollo: string     // Desarrollo de la sesión
  notes: string          // Observaciones particulares
}

export interface ExpedienteResumen {
  antecedentes:       string
  sintomatologia:     string
  prediag_impresion:  string
  prediag_diagnostico: string
  prediag_areas:      string
  prediag_tipo:       string
  prediag_detonadores: string
  prediag_guia:       string
}

export function buildConsultamePrompt(params: {
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
}): string {
  const {
    patientName, initialNote, initialNoteMotivo, initialNoteSubyacente, initialNotePremisas,
    sessionSummaries, inPersonSessions = [], fuentes, expediente,
  } = params

  // Unifica AVI + Presenciales en un solo flujo cronológico
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
      s.objetivo    ? `Objetivo: ${s.objetivo}`           : '',
      s.desarrollo  ? `Desarrollo: ${s.desarrollo}`       : '',
      s.notes       ? `Observaciones: ${s.notes}`         : '',
    ].filter(Boolean).join('\n'),
  }))

  const todasLasSesiones = [...entradasAVI, ...entradasPresenciales]
    .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())

  const sesionesUnificadas = todasLasSesiones.length > 0
    ? todasLasSesiones.map(e => e.texto).join('\n\n')
    : 'No hay sesiones registradas aún.'

  const tieneSesiones = todasLasSesiones.length > 0
  const esAnalisisEvolutivo = tieneSesiones

  // Bloque de Historia Clínica / Prediagnóstico (si existe)
  const tieneExpediente = expediente && (
    expediente.antecedentes || expediente.prediag_impresion || expediente.prediag_diagnostico
  )

  const expedienteBloque = tieneExpediente ? `
HISTORIA CLÍNICA INICIAL Y PREDIAGNÓSTICO:
${expediente!.antecedentes       ? `\nAntecedentes de relevancia:\n${expediente!.antecedentes}` : ''}
${expediente!.sintomatologia     ? `\nSintomatología observada:\n${expediente!.sintomatologia}` : ''}
${expediente!.prediag_impresion  ? `\nImpresión del sujeto: ${expediente!.prediag_impresion}` : ''}
${expediente!.prediag_diagnostico ? `\nDiagnóstico presuntivo: ${expediente!.prediag_diagnostico}` : ''}
${expediente!.prediag_areas      ? `\nÁreas de conflicto: ${expediente!.prediag_areas}` : ''}
${expediente!.prediag_tipo       ? `\nTipo de problema: ${expediente!.prediag_tipo}` : ''}
${expediente!.prediag_detonadores ? `\nDetonadores: ${expediente!.prediag_detonadores}` : ''}
${expediente!.prediag_guia       ? `\nGuía de acción: ${expediente!.prediag_guia}` : ''}
` : ''

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
${expedienteBloque}
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

**PROPUESTA TÉCNICA**
La técnica o enfoque que mejor encaja con este caso, tomada de ConsultoriaFuentes. Explica por qué esta y no otra, y cómo aplicarla concretamente con ${patientName} y su sistema. Usa frases como "Te propondría...", "Sería valioso explorar...", "Te invitaría a...". No recites el manual — aplícala al caso.

**ANÁLISIS DE APEGOS Y HERIDAS**
Para cada persona relevante del sistema familiar: patrón de apego probable, herida principal, cómo trabajarla. Directo.

**PLAN: DIEZ SESIONES**
Sesión por sesión: con quién, qué técnica (nombre y autor), cómo implementarla en este caso concreto. No digas solo "trabajar el apego" — di qué harías, qué preguntarías, qué esperarías lograr.

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
- Prosa corrida en resumen, problemática, interés, propuesta y apegos
- Numerado en el plan de sesiones
- Negritas en el recordatorio
- Todo en español`
}
