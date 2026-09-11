/**
 * McMaster Family Assessment Device (FAD)
 * 60 ítems, 7 dimensiones.
 * Escala: 1=Totalmente de acuerdo, 2=De acuerdo, 3=En desacuerdo, 4=Totalmente en desacuerdo
 * Ítems marcados con reverse=true se invierten al calcular el puntaje.
 * Corte clínico: ≥ 2.0 en cualquier dimensión indica disfunción familiar.
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
  | 'funcionamiento_general'

export const FAD_DIMENSION_LABELS: Record<FADDimension, string> = {
  resolucion_problemas:    'Resolución de problemas',
  comunicacion:            'Comunicación',
  roles:                   'Roles',
  respuesta_afectiva:      'Respuesta afectiva',
  involucramiento_afectivo:'Involucramiento afectivo',
  control_conducta:        'Control de conducta',
  funcionamiento_general:  'Funcionamiento general',
}

// Corte clínico por dimensión (≥ valor = disfunción)
export const FAD_CUTOFFS: Record<FADDimension, number> = {
  resolucion_problemas:     2.2,
  comunicacion:             2.2,
  roles:                    2.3,
  respuesta_afectiva:       2.2,
  involucramiento_afectivo: 2.1,
  control_conducta:         1.9,
  funcionamiento_general:   2.0,
}

export const FAD_ITEMS: FADItem[] = [
  // Resolución de problemas (1,13,25,38,50)
  { id: 1,  text: 'Cuando surge un problema, nos ponemos de acuerdo en lo que vamos a hacer.',                          dimension: 'resolucion_problemas',    reverse: false },
  { id: 13, text: 'Generalmente no hablamos de los problemas que tenemos.',                                              dimension: 'resolucion_problemas',    reverse: true  },
  { id: 25, text: 'Somos capaces de tomar decisiones en cuanto a cómo resolver los problemas.',                          dimension: 'resolucion_problemas',    reverse: false },
  { id: 38, text: 'Cuando algo nos molesta, no sabemos bien qué hacer.',                                                  dimension: 'resolucion_problemas',    reverse: true  },
  { id: 50, text: 'Después de intentar resolver un problema nos detenemos para verificar si funcionó.',                  dimension: 'resolucion_problemas',    reverse: false },

  // Comunicación (2,14,26,39,51)
  { id: 2,  text: 'Es difícil para nosotros decir con palabras lo que queremos decir con ellas.',                        dimension: 'comunicacion',            reverse: true  },
  { id: 14, text: 'Podemos expresarnos directamente sin rodeos.',                                                         dimension: 'comunicacion',            reverse: false },
  { id: 26, text: 'Somos demasiado directos cuando hablamos entre nosotros.',                                             dimension: 'comunicacion',            reverse: true  },
  { id: 39, text: 'Muchas veces en la familia no decimos lo que queremos decir.',                                         dimension: 'comunicacion',            reverse: true  },
  { id: 51, text: 'Tenemos la costumbre de decirnos claramente lo que queremos.',                                         dimension: 'comunicacion',            reverse: false },

  // Roles (3,15,27,40,52,53,54)
  { id: 3,  text: 'En nuestra familia casi siempre somos capaces de asumir distintas responsabilidades.',                dimension: 'roles',                   reverse: false },
  { id: 15, text: 'Hay tareas en la casa que no se hacen porque no hay nadie que las haga.',                              dimension: 'roles',                   reverse: true  },
  { id: 27, text: 'En nuestra familia cada quien sabe cuáles son sus responsabilidades.',                                 dimension: 'roles',                   reverse: false },
  { id: 40, text: 'Cuando hay que hacer algo, siempre sabemos quién lo tiene que hacer.',                                 dimension: 'roles',                   reverse: false },
  { id: 52, text: 'Los miembros de la familia asumen sus responsabilidades.',                                             dimension: 'roles',                   reverse: false },
  { id: 53, text: 'Compartimos las responsabilidades del hogar.',                                                          dimension: 'roles',                   reverse: false },
  { id: 54, text: 'A cada quien se le asigna una tarea justa en la casa.',                                                dimension: 'roles',                   reverse: false },

  // Respuesta afectiva (4,16,28,41,55)
  { id: 4,  text: 'Expresamos nuestros sentimientos a los demás miembros de la familia.',                                 dimension: 'respuesta_afectiva',      reverse: false },
  { id: 16, text: 'En nuestra familia casi nunca mostramos nuestros sentimientos abiertamente.',                          dimension: 'respuesta_afectiva',      reverse: true  },
  { id: 28, text: 'Si alguno de nosotros está triste, los demás miembros de la familia se preocupan.',                   dimension: 'respuesta_afectiva',      reverse: false },
  { id: 41, text: 'Podemos expresar sentimientos negativos sin que cause problemas.',                                     dimension: 'respuesta_afectiva',      reverse: false },
  { id: 55, text: 'Cuando alguno de nosotros está enojado, los demás se dan cuenta.',                                    dimension: 'respuesta_afectiva',      reverse: false },

  // Involucramiento afectivo (5,17,29,42,56)
  { id: 5,  text: 'Nos apoyamos mutuamente.',                                                                             dimension: 'involucramiento_afectivo',reverse: false },
  { id: 17, text: 'Somos demasiado independientes entre nosotros.',                                                       dimension: 'involucramiento_afectivo',reverse: true  },
  { id: 29, text: 'Nos interesamos por las actividades de cada uno.',                                                     dimension: 'involucramiento_afectivo',reverse: false },
  { id: 42, text: 'Realmente nos preocupamos unos por otros.',                                                            dimension: 'involucramiento_afectivo',reverse: false },
  { id: 56, text: 'Somos demasiado apegados entre nosotros.',                                                             dimension: 'involucramiento_afectivo',reverse: true  },

  // Control de conducta (6,18,30,43,57)
  { id: 6,  text: 'En nuestra familia hay reglas claras de comportamiento.',                                              dimension: 'control_conducta',        reverse: false },
  { id: 18, text: 'En nuestra familia tenemos dificultades para hacer respetar las reglas.',                              dimension: 'control_conducta',        reverse: true  },
  { id: 30, text: 'Sabemos qué es lo que está permitido y lo que no en la familia.',                                      dimension: 'control_conducta',        reverse: false },
  { id: 43, text: 'Los castigos son justos en nuestra familia.',                                                          dimension: 'control_conducta',        reverse: false },
  { id: 57, text: 'Podemos cambiar las reglas cuando la situación lo requiere.',                                          dimension: 'control_conducta',        reverse: false },

  // Funcionamiento general (7,8,9,10,11,12,19,20,21,22,23,24,31,32,33,34,35,36,37,44,45,46,47,48,49,58,59,60)
  { id: 7,  text: 'Cuando uno de nosotros pide ayuda, los demás responden.',                                              dimension: 'funcionamiento_general',  reverse: false },
  { id: 8,  text: 'La familia no puede tomar decisiones sobre cómo resolver los problemas.',                              dimension: 'funcionamiento_general',  reverse: true  },
  { id: 9,  text: 'Podemos tomar decisiones difíciles cuando es necesario.',                                              dimension: 'funcionamiento_general',  reverse: false },
  { id: 10, text: 'En nuestra familia no hay lugar para expresar los sentimientos.',                                       dimension: 'funcionamiento_general',  reverse: true  },
  { id: 11, text: 'Nos llevamos bien.',                                                                                   dimension: 'funcionamiento_general',  reverse: false },
  { id: 12, text: 'En nuestra familia no hablamos entre nosotros lo suficiente.',                                         dimension: 'funcionamiento_general',  reverse: true  },
  { id: 19, text: 'En nuestra familia somos capaces de enfrentar situaciones difíciles.',                                 dimension: 'funcionamiento_general',  reverse: false },
  { id: 20, text: 'Aunque lo intentamos, no podemos ponernos de acuerdo en las decisiones.',                              dimension: 'funcionamiento_general',  reverse: true  },
  { id: 21, text: 'Somos una familia que funciona bien.',                                                                 dimension: 'funcionamiento_general',  reverse: false },
  { id: 22, text: 'En general nuestra familia se siente bien.',                                                           dimension: 'funcionamiento_general',  reverse: false },
  { id: 23, text: 'Cuando hay que hacer algo todos cooperamos.',                                                          dimension: 'funcionamiento_general',  reverse: false },
  { id: 24, text: 'Nuestra familia tiene dificultades para aceptar nuevos miembros.',                                     dimension: 'funcionamiento_general',  reverse: true  },
  { id: 31, text: 'Tenemos problemas para relacionarnos con personas fuera de la familia.',                               dimension: 'funcionamiento_general',  reverse: true  },
  { id: 32, text: 'Somos capaces de tomar decisiones cuando la situación lo requiere.',                                   dimension: 'funcionamiento_general',  reverse: false },
  { id: 33, text: 'Cuando algo sale mal, aprendemos de ello.',                                                            dimension: 'funcionamiento_general',  reverse: false },
  { id: 34, text: 'Hay tensión en nuestra familia.',                                                                      dimension: 'funcionamiento_general',  reverse: true  },
  { id: 35, text: 'Somos capaces de adaptar nuestros roles cuando es necesario.',                                         dimension: 'funcionamiento_general',  reverse: false },
  { id: 36, text: 'Generalmente tenemos conflictos sin resolver.',                                                        dimension: 'funcionamiento_general',  reverse: true  },
  { id: 37, text: 'Hay un líder claro en nuestra familia.',                                                               dimension: 'funcionamiento_general',  reverse: false },
  { id: 44, text: 'En nuestra familia cada uno respeta el espacio del otro.',                                             dimension: 'funcionamiento_general',  reverse: false },
  { id: 45, text: 'Sentimos que somos una familia unida.',                                                                dimension: 'funcionamiento_general',  reverse: false },
  { id: 46, text: 'Cada uno puede ser él mismo en nuestra familia.',                                                      dimension: 'funcionamiento_general',  reverse: false },
  { id: 47, text: 'Nuestra familia no se adapta bien a los cambios.',                                                     dimension: 'funcionamiento_general',  reverse: true  },
  { id: 48, text: 'Las crisis en la familia nos unen más.',                                                               dimension: 'funcionamiento_general',  reverse: false },
  { id: 49, text: 'Hay comunicación abierta en nuestra familia.',                                                         dimension: 'funcionamiento_general',  reverse: false },
  { id: 58, text: 'Somos capaces de enfrentar momentos difíciles juntos.',                                                dimension: 'funcionamiento_general',  reverse: false },
  { id: 59, text: 'La familia no responde adecuadamente cuando se necesita apoyo emocional.',                             dimension: 'funcionamiento_general',  reverse: true  },
  { id: 60, text: 'En general estamos satisfechos con nuestra familia.',                                                  dimension: 'funcionamiento_general',  reverse: false },
]

/** Calcula los puntajes por dimensión a partir de las respuestas del paciente.
 *  responses: { "1": 3, "2": 1, ... }  (clave = id del ítem, valor = 1-4)
 */
export function calcularPuntajesFAD(responses: Record<string, number>): Record<FADDimension, number> {
  const sums: Record<FADDimension, number> = {
    resolucion_problemas:     0,
    comunicacion:             0,
    roles:                    0,
    respuesta_afectiva:       0,
    involucramiento_afectivo: 0,
    control_conducta:         0,
    funcionamiento_general:   0,
  }
  const counts: Record<FADDimension, number> = { ...sums }

  for (const item of FAD_ITEMS) {
    const raw = responses[String(item.id)]
    if (raw == null) continue
    const score = item.reverse ? (5 - raw) : raw
    sums[item.dimension]  += score
    counts[item.dimension] += 1
  }

  const result = {} as Record<FADDimension, number>
  for (const dim of Object.keys(sums) as FADDimension[]) {
    result[dim] = counts[dim] > 0 ? +(sums[dim] / counts[dim]).toFixed(2) : 0
  }
  return result
}
