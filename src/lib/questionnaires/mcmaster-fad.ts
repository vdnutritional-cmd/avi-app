/**
 * McMaster Family Assessment Device (FAD) — versión AVI
 * 60 ítems, 6 dimensiones (sin Funcionamiento General como dimensión independiente).
 *
 * Escala de respuesta:
 *   1 = Totalmente de acuerdo
 *   2 = De acuerdo
 *   3 = Ni en acuerdo ni en desacuerdo
 *   4 = En desacuerdo
 *   5 = Totalmente en desacuerdo
 *
 * Puntaje del ítem:
 *   Ítem normal   → puntaje = respuesta
 *   Ítem invertido → puntaje = 6 − respuesta
 */

export interface FADItem {
  id: number
  text: string
  dimension: FADDimension
  reverse: boolean
}

export type FADDimension =
  | 'resolucion_problemas'
  | 'comunicacion'
  | 'roles'
  | 'respuesta_afectiva'
  | 'involucramiento_afectivo'
  | 'control_conducta'

export const FAD_DIMENSION_LABELS: Record<FADDimension, string> = {
  resolucion_problemas:     'Resolución de problemas',
  comunicacion:             'Comunicación',
  roles:                    'Roles',
  respuesta_afectiva:       'Respuesta afectiva',
  involucramiento_afectivo: 'Involucramiento afectivo',
  control_conducta:         'Control de conducta',
}

// Orden canónico de dimensiones para el reporte
export const FAD_DIMENSION_ORDER: FADDimension[] = [
  'resolucion_problemas',
  'comunicacion',
  'roles',
  'respuesta_afectiva',
  'involucramiento_afectivo',
  'control_conducta',
]

// ── Ítems (orden de presentación al paciente: 1→60) ───────────────────────────
export const FAD_ITEMS: FADItem[] = [
  // ── Resolución de problemas: 1,7,8,9,13,19,20,25,32,33,36,38,50,58
  { id:  1, text: 'Cuando surge un problema, nos ponemos de acuerdo en lo que vamos a hacer.',                         dimension: 'resolucion_problemas',    reverse: false },
  { id:  7, text: 'Cuando uno de nosotros pide ayuda, los demás responden.',                                           dimension: 'resolucion_problemas',    reverse: false },
  { id:  8, text: 'La familia no puede tomar decisiones sobre cómo resolver los problemas.',                           dimension: 'resolucion_problemas',    reverse: true  },
  { id:  9, text: 'Podemos tomar decisiones difíciles cuando es necesario.',                                           dimension: 'resolucion_problemas',    reverse: false },
  { id: 13, text: 'Generalmente no hablamos de los problemas que tenemos.',                                            dimension: 'resolucion_problemas',    reverse: true  },
  { id: 19, text: 'En nuestra familia somos capaces de enfrentar situaciones difíciles.',                              dimension: 'resolucion_problemas',    reverse: false },
  { id: 20, text: 'Aunque lo intentamos, no podemos ponernos de acuerdo en las decisiones.',                          dimension: 'resolucion_problemas',    reverse: true  },
  { id: 25, text: 'Somos capaces de tomar decisiones en cuanto a cómo resolver los problemas.',                       dimension: 'resolucion_problemas',    reverse: false },
  { id: 32, text: 'Somos capaces de tomar decisiones cuando la situación lo requiere.',                               dimension: 'resolucion_problemas',    reverse: false },
  { id: 33, text: 'Cuando algo sale mal, aprendemos de ello.',                                                         dimension: 'resolucion_problemas',    reverse: false },
  { id: 36, text: 'Generalmente tenemos conflictos sin resolver.',                                                     dimension: 'resolucion_problemas',    reverse: true  },
  { id: 38, text: 'Cuando algo nos molesta, no sabemos bien qué hacer.',                                               dimension: 'resolucion_problemas',    reverse: true  },
  { id: 50, text: 'Después de intentar resolver un problema nos detenemos para verificar si funcionó.',               dimension: 'resolucion_problemas',    reverse: false },
  { id: 58, text: 'Somos capaces de enfrentar momentos difíciles juntos.',                                             dimension: 'resolucion_problemas',    reverse: false },

  // ── Comunicación: 2,12,14,26,31,39,49,51
  { id:  2, text: 'Es difícil para nosotros decir con palabras lo que queremos decir con ellas.',                     dimension: 'comunicacion',            reverse: true  },
  { id: 12, text: 'En nuestra familia no hablamos entre nosotros lo suficiente.',                                      dimension: 'comunicacion',            reverse: true  },
  { id: 14, text: 'Podemos expresarnos directamente sin rodeos.',                                                      dimension: 'comunicacion',            reverse: false },
  { id: 26, text: 'Somos demasiado directos cuando hablamos entre nosotros.',                                          dimension: 'comunicacion',            reverse: true  },
  { id: 31, text: 'Tenemos problemas para relacionarnos con personas fuera de la familia.',                            dimension: 'comunicacion',            reverse: true  },
  { id: 39, text: 'Muchas veces en la familia no decimos lo que queremos decir.',                                      dimension: 'comunicacion',            reverse: true  },
  { id: 49, text: 'Hay comunicación abierta en nuestra familia.',                                                      dimension: 'comunicacion',            reverse: false },
  { id: 51, text: 'Tenemos la costumbre de decirnos claramente lo que queremos.',                                      dimension: 'comunicacion',            reverse: false },

  // ── Roles: 3,15,27,35,37,40,52,53,54
  { id:  3, text: 'En nuestra familia casi siempre somos capaces de asumir distintas responsabilidades.',             dimension: 'roles',                   reverse: false },
  { id: 15, text: 'Hay tareas en la casa que no se hacen porque no hay nadie que las haga.',                          dimension: 'roles',                   reverse: true  },
  { id: 27, text: 'En nuestra familia cada quien sabe cuáles son sus responsabilidades.',                             dimension: 'roles',                   reverse: false },
  { id: 35, text: 'Somos capaces de adaptar nuestros roles cuando es necesario.',                                      dimension: 'roles',                   reverse: false },
  { id: 37, text: 'Hay un líder claro en nuestra familia.',                                                            dimension: 'roles',                   reverse: false },
  { id: 40, text: 'Cuando hay que hacer algo, siempre sabemos quién lo tiene que hacer.',                             dimension: 'roles',                   reverse: false },
  { id: 52, text: 'Los miembros de la familia asumen sus responsabilidades.',                                          dimension: 'roles',                   reverse: false },
  { id: 53, text: 'Compartimos las responsabilidades del hogar.',                                                      dimension: 'roles',                   reverse: false },
  { id: 54, text: 'A cada quien se le asigna una tarea justa en la casa.',                                            dimension: 'roles',                   reverse: false },

  // ── Respuesta afectiva: 4,10,16,22,28,41,48,55
  { id:  4, text: 'Expresamos nuestros sentimientos a los demás miembros de la familia.',                             dimension: 'respuesta_afectiva',      reverse: false },
  { id: 10, text: 'En nuestra familia no hay lugar para expresar los sentimientos.',                                   dimension: 'respuesta_afectiva',      reverse: true  },
  { id: 16, text: 'En nuestra familia casi nunca mostramos nuestros sentimientos abiertamente.',                      dimension: 'respuesta_afectiva',      reverse: true  },
  { id: 22, text: 'En general nuestra familia se siente bien.',                                                        dimension: 'respuesta_afectiva',      reverse: false },
  { id: 28, text: 'Si alguno de nosotros está triste, los demás miembros de la familia se preocupan.',               dimension: 'respuesta_afectiva',      reverse: false },
  { id: 41, text: 'Podemos expresar sentimientos negativos sin que cause problemas.',                                  dimension: 'respuesta_afectiva',      reverse: false },
  { id: 48, text: 'Las crisis en la familia nos unen más.',                                                            dimension: 'respuesta_afectiva',      reverse: false },
  { id: 55, text: 'Cuando alguno de nosotros está enojado, los demás se dan cuenta.',                                 dimension: 'respuesta_afectiva',      reverse: false },

  // ── Involucramiento afectivo: 5,17,23,24,29,34,42,45,56,59
  { id:  5, text: 'Nos apoyamos mutuamente.',                                                                          dimension: 'involucramiento_afectivo', reverse: false },
  { id: 17, text: 'Somos demasiado independientes entre nosotros.',                                                    dimension: 'involucramiento_afectivo', reverse: true  },
  { id: 23, text: 'Cuando hay que hacer algo todos cooperamos.',                                                       dimension: 'involucramiento_afectivo', reverse: false },
  { id: 24, text: 'Nuestra familia tiene dificultades para aceptar nuevos miembros.',                                  dimension: 'involucramiento_afectivo', reverse: true  },
  { id: 29, text: 'Nos interesamos por las actividades de cada uno.',                                                  dimension: 'involucramiento_afectivo', reverse: false },
  { id: 34, text: 'Hay tensión en nuestra familia.',                                                                   dimension: 'involucramiento_afectivo', reverse: true  },
  { id: 42, text: 'Realmente nos preocupamos unos por otros.',                                                         dimension: 'involucramiento_afectivo', reverse: false },
  { id: 45, text: 'Sentimos que somos una familia unida.',                                                             dimension: 'involucramiento_afectivo', reverse: false },
  { id: 56, text: 'Somos demasiado apegados entre nosotros.',                                                          dimension: 'involucramiento_afectivo', reverse: true  },
  { id: 59, text: 'La familia no responde adecuadamente cuando se necesita apoyo emocional.',                         dimension: 'involucramiento_afectivo', reverse: true  },

  // ── Control de conducta: 6,11,18,21,30,43,44,46,47,57,60
  { id:  6, text: 'En nuestra familia hay reglas claras de comportamiento.',                                           dimension: 'control_conducta',        reverse: false },
  { id: 11, text: 'Nos llevamos bien.',                                                                                dimension: 'control_conducta',        reverse: false },
  { id: 18, text: 'En nuestra familia tenemos dificultades para hacer respetar las reglas.',                          dimension: 'control_conducta',        reverse: true  },
  { id: 21, text: 'Somos una familia que funciona bien.',                                                              dimension: 'control_conducta',        reverse: false },
  { id: 30, text: 'Sabemos qué es lo que está permitido y lo que no en la familia.',                                  dimension: 'control_conducta',        reverse: false },
  { id: 43, text: 'Los castigos son justos en nuestra familia.',                                                       dimension: 'control_conducta',        reverse: false },
  { id: 44, text: 'En nuestra familia cada uno respeta el espacio del otro.',                                         dimension: 'control_conducta',        reverse: false },
  { id: 46, text: 'Cada uno puede ser él mismo en nuestra familia.',                                                   dimension: 'control_conducta',        reverse: false },
  { id: 47, text: 'Nuestra familia no se adapta bien a los cambios.',                                                  dimension: 'control_conducta',        reverse: true  },
  { id: 57, text: 'Podemos cambiar las reglas cuando la situación lo requiere.',                                       dimension: 'control_conducta',        reverse: false },
  { id: 60, text: 'En general estamos satisfechos con nuestra familia.',                                               dimension: 'control_conducta',        reverse: false },
]

// ── Tipos de resultado ────────────────────────────────────────────────────────
export interface FADDimResult {
  VD:     number   // Suma de puntajes de la dimensión
  ND:     number   // Número de ítems
  pctFD:  number   // % Funcionalidad (1 decimal)
  pctDD:  number   // % Disfuncionalidad (1 decimal)
}

export interface FADResult {
  dimensions: Record<FADDimension, FADDimResult>
  global: {
    SVD:      number   // Suma de todos los VD
    pctRED:   number   // % Evaluación Disfuncional (1 decimal)
    pctREF:   number   // % Evaluación Funcional (1 decimal)
    evaluacion: 'FUNCIONAL' | 'DISFUNCIONAL'
  }
}

// ── Función principal de cálculo ──────────────────────────────────────────────
export function calcularResultadoFAD(responses: Record<string, number>): FADResult {
  const dimensions = {} as Record<FADDimension, FADDimResult>

  for (const dim of FAD_DIMENSION_ORDER) {
    const itemsDim = FAD_ITEMS.filter(i => i.dimension === dim)
    const nd = itemsDim.length

    // VD(i) = suma de puntajes de los ítems de la dimensión
    let vd = 0
    for (const item of itemsDim) {
      const raw = responses[String(item.id)]
      if (raw == null) continue
      vd += item.reverse ? (6 - raw) : raw
    }

    // VMinD = ND, VMaxD = 5×ND
    const vMin = nd
    const vMax = 5 * nd

    // VDD = (VD - VMin) / (VMax - VMin)
    const vDD = (vd - vMin) / (vMax - vMin)
    const vFD = 1 - vDD

    dimensions[dim] = {
      VD:    vd,
      ND:    nd,
      pctFD: +((vFD * 100).toFixed(1)),
      pctDD: +((vDD * 100).toFixed(1)),
    }
  }

  // SVD = suma de todos los VD
  const svd = FAD_DIMENSION_ORDER.reduce((acc, dim) => acc + dimensions[dim].VD, 0)

  // VRED = (SVD - 60) / (300 - 60) = (SVD - 60) / 240
  const vred = (svd - 60) / 240
  const vref = 1 - vred
  const pctRED = +((vred * 100).toFixed(1))
  const pctREF = +((vref * 100).toFixed(1))

  return {
    dimensions,
    global: {
      SVD:        svd,
      pctRED,
      pctREF,
      evaluacion: pctREF > pctRED ? 'FUNCIONAL' : 'DISFUNCIONAL',
    },
  }
}

// Alias para compatibilidad (el API route lo usaba)
export { calcularResultadoFAD as calcularPuntajesFAD }
