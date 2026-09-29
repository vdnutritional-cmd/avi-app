// ─────────────────────────────────────────────────────────────────────────────
// factores-nota-inicial.ts
//
// Tablas de lookup para todos los Factores de Riesgo y Protección de la
// Nota Inicial, organizados por Esquema Terapéutico y Tipo de Caso.
//
// Uso: FamiliarTab, ParejaTab e IndividualTab los importan para mostrar
// los factores activos seleccionados por el terapeuta en la Nota Inicial.
// ─────────────────────────────────────────────────────────────────────────────

export interface FactorItem {
  key:    string
  titulo: string
  desc:   string
}

export interface FactorGroup {
  schema:      string  // 'famsis' | 'trec' | 'cc'
  schemaLabel: string
  items:       FactorItem[]
}

// ── Labels de esquemas ────────────────────────────────────────────────────────
export const SCHEMA_LABELS: Record<string, string> = {
  famsis: '🏠 Terapia Familiar Sistémica',
  trec:   '🧠 TREC',
  cc:     '💡 TCC',
}

// ── Columnas en therapist_patients ────────────────────────────────────────────
export const SCHEMA_RIESGO_COL: Record<string, string> = {
  famsis: 'factores_riesgo_sel',
  trec:   'factores_riesgo_trec',
  cc:     'factores_riesgo_tcc',
}

export const SCHEMA_PROTECCION_COL: Record<string, string> = {
  famsis: 'factores_proteccion_sel',
  trec:   'factores_proteccion_trec',
  cc:     'factores_proteccion_tcc',
}

// ─────────────────────────────────────────────────────────────────────────────
// TFS — Terapia Familiar Sistémica
// ─────────────────────────────────────────────────────────────────────────────

export const IND_RIESGO_TFS: FactorItem[] = [
  { key: 'posicion_rigida',          titulo: 'Posición rígida en el sistema',     desc: 'Chivo expiatorio, héroe, cuidador parental.' },
  { key: 'corte_emocional',          titulo: 'Corte emocional',                    desc: 'Ruptura significativa con la familia de origen.' },
  { key: 'patron_transgeneracional', titulo: 'Patrón transgeneracional repetido',  desc: 'Lealtad a un guion familiar disfuncional.' },
  { key: 'aislamiento_relacional',   titulo: 'Aislamiento relacional',             desc: 'Ausencia de red de apoyo significativa.' },
  { key: 'indiferenciacion',         titulo: 'Indiferenciación de sí mismo',       desc: 'Incapacidad de tener pensamientos, sentimientos, valores y decisiones propias, distintas de las de su familia o pareja.' },
  { key: 'homeostasis_individual',   titulo: 'Homeostasis individual',             desc: 'El síntoma protege al sistema de un cambio mayor.' },
]

export const IND_PROTECCION_TFS: FactorItem[] = [
  { key: 'claridad_limites',         titulo: 'Claridad de límites',                desc: 'Capacidad de mantener distancia emocional adecuada sin fusionarse ni aislarse.' },
  { key: 'diferenciacion_self',      titulo: 'Diferenciación de mí mismo (del self)', desc: 'Distinguir los propios pensamientos y emociones de los de los demás.' },
  { key: 'capacidad_introspeccion',  titulo: 'Capacidad de introspección',         desc: 'Reflexionar sobre sí mismo y evaluarse de forma honesta para mejorar.' },
  { key: 'autonomia',                titulo: 'Autonomía',                           desc: 'Mantener distancia emocional y física de las fuentes de estrés sin aislarse.' },
  { key: 'habilidad_relacionarse',   titulo: 'Habilidad para relacionarse',        desc: 'Establecer vínculos íntimos equilibrando las propias necesidades con las del otro.' },
]

export const FAM_RIESGO_TFS: FactorItem[] = [
  { key: 'limites_difusos',           titulo: 'Límites difusos o rígidos',              desc: 'Familias aglutinadas (donde no hay individualidad ni privacidad) o familias desligadas (donde hay desapego extremo y falta de apoyo).' },
  { key: 'triangulacion',             titulo: 'Triangulación',                           desc: 'Involucrar a un tercero (frecuentemente un hijo) para desviar el conflicto entre dos miembros (generalmente la pareja).' },
  { key: 'parentificacion',           titulo: 'Parentificación',                         desc: 'Inversión de roles donde un hijo asume responsabilidades parentales, emocionales o económicas que no corresponden a su edad.' },
  { key: 'comunicacion_patologica',   titulo: 'Comunicación patológica',                 desc: 'Presencia de dobles mensajes (mensajes contradictorios), descalificaciones continuas o secretos familiares disfuncionales.' },
  { key: 'rigidez_homeostatica',      titulo: 'Rigidez homeostática',                    desc: 'Incapacidad del sistema para cambiar y adaptarse a las nuevas etapas del ciclo vital (ej. tratar a un adolescente como si fuera un niño pequeño).' },
  { key: 'alianzas_destructivas',     titulo: 'Alianzas e interacciones destructivas',   desc: 'Coaliciones (unión de dos miembros contra un tercero) que rompen las jerarquías naturales de la familia.' },
  { key: 'ciclo_vital_no_resuelto',   titulo: 'Ciclo vital no resuelto',                 desc: 'Dificultades para transitar etapas evolutivas (nido vacío, adolescencia, jubilación).' },
  { key: 'lealtades_invisibles',      titulo: 'Lealtades invisibles',                    desc: 'Mandatos transgeneracionales no cuestionados.' },
  { key: 'delegacion_sintoma',        titulo: 'Delegación del síntoma',                  desc: 'Un miembro (identificado como paciente) porta el conflicto de todo el sistema.' },
]

export const FAM_PROTECCION_TFS: FactorItem[] = [
  { key: 'limites_claros',            titulo: 'Límites claros y flexibles',              desc: 'Reglas comprensibles que definen los roles de cada uno, permitiendo la cercanía emocional sin perder la autonomía individual.' },
  { key: 'cohesion_familiar',         titulo: 'Cohesión familiar',                       desc: 'Sentimiento de pertenencia, afecto mutuo y apoyo emocional disponible entre los miembros del grupo.' },
  { key: 'comunicacion_asertiva',     titulo: 'Comunicación asertiva y abierta',         desc: 'Capacidad para expresar emociones, resolver conflictos de forma directa y validar los puntos de vista de los demás.' },
  { key: 'flexibilidad',              titulo: 'Flexibilidad y adaptabilidad',             desc: 'Capacidad del sistema para reorganizar sus reglas, roles y jerarquías ante crisis o cambios del entorno.' },
  { key: 'jerarquia_parental',        titulo: 'Jerarquía parental clara',                desc: 'Figuras de autoridad (padres/cuidadores) coordinadas, que actúan de mutuo acuerdo y ejercen un liderazgo nutridor.' },
  { key: 'redes_apoyo',               titulo: 'Redes de apoyo externas',                 desc: 'Conexiones saludables con la familia extensa, la escuela, amigos o la comunidad que sostienen al sistema familiar.' },
]

export const PAR_RIESGO_TFS: FactorItem[] = [
  { key: 'escalada_simetrica',       titulo: 'Escalada simétrica',                 desc: 'Ambos escalan en intensidad sin ceder.' },
  { key: 'complementariedad_rigida', titulo: 'Complementariedad rígida',           desc: 'Uno siempre persigue, el otro siempre se distancia.' },
  { key: 'triangulacion_pareja',     titulo: 'Triangulación con hijos, familiares o terceros', desc: 'Involucrar a un tercero (frecuentemente un hijo) para desviar el conflicto entre los miembros de la pareja.' },
  { key: 'fronteras_difusas',        titulo: 'Fronteras difusas con familias de origen', desc: 'Intromisión parental.' },
  { key: 'perdida_rituales',         titulo: 'Pérdida de rituales de pareja',      desc: 'Desconexión emocional y sexual.' },
  { key: 'ciclo_vital_no_negociado', titulo: 'Ciclo vital no negociado',           desc: 'Transiciones (convivencia, hijos, nido vacío) sin renegociación de acuerdos.' },
  { key: 'lealtades_divididas',      titulo: 'Lealtades divididas',                desc: 'Conflicto entre pareja y familia de origen.' },
  { key: 'homeostasis_conflictiva',  titulo: 'Homeostasis conflictiva',            desc: 'El conflicto crónico como forma de mantenerse unidos.' },
]

export const PAR_PROTECCION_TFS: FactorItem[] = [
  { key: 'motivacion_mutua',           titulo: 'Motivación mutua de cambio',         desc: 'Ambos miembros comprometidos con mejorar la relación.' },
  { key: 'cohesion_pareja',            titulo: 'Cohesión de pareja',                 desc: 'Vínculo emocional y sentido de unidad entre ambos.' },
  { key: 'responsabilidad_compartida', titulo: 'Responsabilidad compartida',         desc: 'Disposición a asumir responsabilidades conjuntas.' },
  { key: 'capacidad_reflexiva',        titulo: 'Capacidad reflexiva',                desc: 'Habilidad de ambos para pensar sobre sus patrones e interacciones.' },
  { key: 'apoyo_socioeconomico',       titulo: 'Apoyo socioeconómico',               desc: 'Recursos externos que amortiguan el estrés de la relación.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// TREC — Terapia Racional Emotivo-Conductual
// ─────────────────────────────────────────────────────────────────────────────

export const IND_RIESGO_TREC: FactorItem[] = [
  { key: 'pensamiento_dicotomico',      titulo: 'Pensamiento dicotómico / Distorsiones cognitivas', desc: '"Todo o nada", "siempre/nunca", catastrofización.' },
  { key: 'baja_tolerancia_frustracion', titulo: 'Baja tolerancia a la frustración',                desc: 'Incapacidad de tolerar la incomodidad sin recurrir a conductas evitativas o impulsivas.' },
  { key: 'irracionalidad_creencias',    titulo: 'Irracionalidad de las creencias nucleares',       desc: 'Adherencia rígida a "debo…", "tengo que…", "es terrible que…"' },
  { key: 'exigencias_absolutistas',     titulo: 'Exigencias absolutistas (musturbation)',          desc: 'Reglas absolutas aplicadas a uno mismo, a los demás o al mundo.' },
  { key: 'autocondenacion',             titulo: 'Autocondenación',                                 desc: 'Condenarse como persona total por errores específicos.' },
  { key: 'baja_autoeficacia',           titulo: 'Baja autoeficacia percibida',                    desc: 'Creencia de no poder manejar la adversidad o el malestar emocional.' },
  { key: 'conductas_evitacion',         titulo: 'Conductas de evitación y seguridad',             desc: 'Evitar situaciones que generan malestar, lo que refuerza la creencia irracional.' },
]

export const IND_PROTECCION_TREC: FactorItem[] = [
  { key: 'flexibilidad_cognitiva',      titulo: 'Flexibilidad cognitiva',         desc: 'Capacidad de cuestionar y reformular creencias rígidas.' },
  { key: 'alta_tolerancia_frustracion', titulo: 'Alta tolerancia a la frustración', desc: 'Aceptar la incomodidad como parte natural de la vida.' },
  { key: 'autocompasion_funcional',     titulo: 'Autocompasión funcional',         desc: 'Distinguir conducta (evaluable) de valía global como persona.' },
  { key: 'capacidad_debate_racional',   titulo: 'Capacidad de debate racional',    desc: 'Habilidad para aplicar el debate socrático a las propias creencias.' },
  { key: 'orientacion_problema',        titulo: 'Orientación al problema',         desc: 'Enfoque en soluciones más que en la culpa o el resentimiento.' },
]

export const FAM_RIESGO_TREC: FactorItem[] = [
  { key: 'creencias_fam_disfuncionales', titulo: 'Sistema de creencias familiares disfuncionales', desc: 'Reglas implícitas del tipo "en esta familia nunca se muestra debilidad."' },
  { key: 'refuerzo_irracionalidad',      titulo: 'Refuerzo familiar de la irracionalidad',         desc: 'La familia valida o alimenta las creencias irracionales del paciente.' },
  { key: 'exigencia_parental',           titulo: 'Alta exigencia parental / perfeccionismo',        desc: 'Estándares excesivamente altos transmitidos como expectativas incondicionales.' },
  { key: 'invalidacion_emocional',       titulo: 'Invalidación emocional crónica',                 desc: 'Mensajes reiterados de que las emociones del paciente son exageradas o incorrectas.' },
  { key: 'modelos_baja_tolerancia',      titulo: 'Modelos de rol con baja tolerancia a la frustración', desc: 'Padres o cuidadores que modelan reacciones catastróficas o evitativas.' },
  { key: 'estigma_familiar',             titulo: 'Estigma familiar hacia la terapia o las emociones', desc: 'Creencia de que buscar ayuda o expresar emociones es signo de debilidad.' },
]

export const FAM_PROTECCION_TREC: FactorItem[] = [
  { key: 'clima_cuestionamiento',        titulo: 'Clima familiar de cuestionamiento racional', desc: 'Conversaciones abiertas donde se debaten creencias e ideas.' },
  { key: 'modelos_autorregulacion',      titulo: 'Modelos parentales de autorregulación',      desc: 'Cuidadores que demuestran manejo emocional y resolución de problemas.' },
  { key: 'apoyo_proceso_terapeutico',    titulo: 'Apoyo familiar ante el proceso terapéutico', desc: 'La familia refuerza la asistencia y los cambios trabajados en terapia.' },
  { key: 'flexibilidad_reglas_fam',      titulo: 'Flexibilidad en las reglas familiares',      desc: 'Capacidad de revisar y actualizar normas y expectativas según el contexto.' },
]

export const PAR_RIESGO_TREC: FactorItem[] = [
  { key: 'exigencias_absolutistas_par',  titulo: 'Exigencias absolutistas en la relación',         desc: '"Mi pareja debe…" o "la relación tiene que…" aplicados de forma rígida.' },
  { key: 'intolerancia_imperfeccion',    titulo: 'Intolerancia a la imperfección del otro',         desc: 'Baja tolerancia a los errores, limitaciones o diferencias de la pareja.' },
  { key: 'catastrofizacion_conflictos',  titulo: 'Catastrofización de conflictos',                  desc: 'Interpretar cada desacuerdo como el fin de la relación o como insoportable.' },
  { key: 'culpabilizacion_mutua',        titulo: 'Culpabilización y condenación mutua',             desc: 'Condenar al otro como persona total por conductas específicas.' },
  { key: 'comunicacion_irracional',      titulo: 'Comunicación basada en creencias irracionales',   desc: 'Exigir, agredir pasivamente o evitar el diálogo por miedo al rechazo.' },
  { key: 'baja_tolerancia_compartida',   titulo: 'Baja tolerancia a la frustración compartida',     desc: 'Ninguno tolera el malestar inherente a la negociación y el acuerdo.' },
  { key: 'dependencia_emocional',        titulo: 'Dependencia emocional basada en "necesidades"',   desc: 'Creer que "necesito" al otro para ser feliz o funcionar.' },
]

export const PAR_PROTECCION_TREC: FactorItem[] = [
  { key: 'preferencias_racionales',      titulo: 'Preferencias racionales en la relación',      desc: 'Desear sin exigir; aceptar la imperfección del otro como parte de la relación.' },
  { key: 'disputa_racional_compartida',  titulo: 'Capacidad de disputa racional compartida',    desc: 'Ambos pueden cuestionar sus propias creencias irracionales en el conflicto.' },
  { key: 'compromiso_terapia_pareja',    titulo: 'Compromiso con la terapia de pareja',         desc: 'Disposición de ambos a explorar y cambiar sus patrones cognitivo-conductuales.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// TCC — Terapia Cognitivo-Conductual
// ─────────────────────────────────────────────────────────────────────────────

export const IND_RIESGO_TCC: FactorItem[] = [
  { key: 'creencias_centrales_dis',    titulo: 'Creencias centrales disfuncionales',  desc: 'Ideas profundas y rígidas sobre uno mismo ("no valgo", "soy incapaz"), sobre los demás ("nadie es confiable") y sobre el mundo ("todo es peligroso").' },
  { key: 'distorsiones_cognitivas_tcc', titulo: 'Distorsiones cognitivas',           desc: 'Pensamientos automáticos erróneos: catastrofización, pensamiento dicotómico, lectura de mente, sobregeneralización.' },
  { key: 'deficit_habilidades',         titulo: 'Déficit de habilidades',            desc: 'Falta de habilidades sociales, de resolución de problemas o de regulación emocional.' },
  { key: 'evitacion_conductual_tcc',    titulo: 'Evitación conductual',              desc: 'Creencia de que no se es capaz de enfrentar situaciones o cambiar.' },
  { key: 'historia_aprendizaje_tcc',    titulo: 'Historia de aprendizaje',           desc: 'Experiencias tempranas de rechazo, crítica excesiva o inconsistencia que moldearon esquemas negativos.' },
  { key: 'sintomas_residuales',         titulo: 'Síntomas residuales',               desc: 'Presencia de síntomas leves persistentes tras un tratamiento, que aumentan el riesgo de recaída.' },
  { key: 'comorbilidad',                titulo: 'Comorbilidad',                      desc: 'Presencia simultánea de dos o más trastornos que complican el cuadro.' },
  { key: 'rigidez_cognitiva_tcc',       titulo: 'Rigidez cognitiva',                 desc: 'Dificultad para modificar creencias incluso ante evidencia contradictoria.' },
  { key: 'perfeccionismo_tcc',          titulo: 'Perfeccionismo',                    desc: 'Estándares excesivamente altos que generan frustración crónica y autoexigencia.' },
]

export const IND_PROTECCION_TCC: FactorItem[] = [
  { key: 'reestructuracion_cognitiva',   titulo: 'Capacidad de reestructuración cognitiva', desc: 'Identificar, evaluar y modificar pensamientos automáticos y creencias disfuncionales.' },
  { key: 'resolucion_problemas_tcc',     titulo: 'Habilidades de resolución de problemas',  desc: 'Analizar dificultades y generar soluciones de forma sistemática.' },
  { key: 'activacion_conductual_tcc',    titulo: 'Activación conductual',                   desc: 'Aumentar actividades positivas para mejorar el estado de ánimo.' },
  { key: 'automonitoreo_tcc',            titulo: 'Automonitoreo',                           desc: 'Observar y registrar los propios patrones de pensamiento, emoción y conducta.' },
  { key: 'repertorio_afrontamiento_tcc', titulo: 'Repertorio de afrontamiento',             desc: 'Contar con estrategias concretas para manejar situaciones de estrés.' },
]

export const FAM_RIESGO_TCC: FactorItem[] = [
  { key: 'alto_conflicto_fam_tcc',      titulo: 'Alto conflicto familiar',               desc: 'Discusiones frecuentes, hostilidad y tensión constante que generan estrés crónico en todos los miembros.' },
  { key: 'critica_culpa_parental',       titulo: 'Crítica y culpa parental',              desc: 'Padres que señalan constantemente los errores de los hijos, fomentando creencias de incapacidad y baja autoestima.' },
  { key: 'baja_cohesion_fam_tcc',        titulo: 'Baja cohesión familiar',               desc: 'Falta de apoyo emocional, desconexión entre miembros, cada uno "por su lado".' },
  { key: 'comunicacion_dis_fam_tcc',     titulo: 'Comunicación disfuncional',            desc: 'Mensajes contradictorios, dobles vínculos, falta de escucha activa, expresiones de emoción inadecuadas.' },
  { key: 'crianza_inconsistente',        titulo: 'Estilos de crianza inconsistentes',    desc: 'Alternar entre permisividad y autoritarismo, sin normas claras ni consecuencias predecibles.' },
  { key: 'modelamiento_desadaptativo',   titulo: 'Modelamiento de conductas desadaptativas', desc: 'Padres que muestran evitación, agresividad o desregulación emocional como forma de afrontamiento.' },
  { key: 'sobreproteccion_tcc',          titulo: 'Sobreprotección',                      desc: 'Impedir que los hijos enfrenten retos, lo que refuerza creencias de incapacidad y baja autoeficacia.' },
  { key: 'parentalizacion_tcc',          titulo: 'Parentalización',                      desc: 'Hijos que asumen roles de cuidado o sostén emocional que no les corresponden.' },
  { key: 'rigidez_roles_tcc',            titulo: 'Rigidez de roles',                     desc: 'Cada miembro atrapado en un papel fijo (chivo expiatorio, héroe, cuidador) sin posibilidad de cambio.' },
  { key: 'secretos_prohibidos_tcc',      titulo: 'Secretos y temas prohibidos',          desc: 'Información oculta o temas que no se pueden hablar, generando desconfianza y ansiedad.' },
  { key: 'expectativas_irreales_fam_tcc', titulo: 'Expectativas irreales',               desc: 'Demandas familiares que no coinciden con las capacidades o deseos del miembro.' },
  { key: 'falta_limites_tcc',            titulo: 'Falta de límites claros',              desc: 'Confusión entre subsistemas (conyugal, parental, filial), invasión de espacios y funciones.' },
]

export const FAM_PROTECCION_TCC: FactorItem[] = [
  { key: 'reestructuracion_cog_fam',    titulo: 'Capacidad de reestructuración cognitiva', desc: 'Identificar, evaluar y modificar pensamientos automáticos y creencias disfuncionales.' },
  { key: 'resolucion_prob_fam_tcc',     titulo: 'Habilidades de resolución de problemas',  desc: 'Analizar dificultades y generar soluciones de forma sistemática.' },
  { key: 'activacion_cond_fam_tcc',     titulo: 'Activación conductual',                   desc: 'Aumentar actividades positivas para mejorar el estado de ánimo.' },
  { key: 'automonitoreo_fam_tcc',       titulo: 'Automonitoreo',                           desc: 'Observar y registrar los propios patrones de pensamiento, emoción y conducta.' },
  { key: 'repertorio_afron_fam_tcc',    titulo: 'Repertorio de afrontamiento',             desc: 'Contar con estrategias concretas para manejar situaciones de estrés.' },
]

export const PAR_RIESGO_TCC: FactorItem[] = [
  { key: 'atribuciones_negativas',       titulo: 'Atribuciones negativas',              desc: 'Interpretar el comportamiento del otro como intencionalmente malo ("lo hace para molestarme").' },
  { key: 'lectura_mente_par_tcc',        titulo: 'Lectura de mente',                    desc: 'Asumir lo que el otro piensa o siente sin verificar ("sé que ya no me quiere").' },
  { key: 'catastrofizacion_par_tcc',     titulo: 'Catastrofización',                    desc: 'Convertir un problema menor en una crisis ("si llegó tarde, seguro me está engañando").' },
  { key: 'expectativas_irreales_par_tcc', titulo: 'Expectativas irreales',              desc: 'Creencias como "debería saber lo que necesito sin que se lo diga".' },
  { key: 'comunicacion_dis_par_tcc',     titulo: 'Comunicación disfuncional',           desc: 'Expresiones indirectas, sarcasmo, críticas constantes, falta de escucha, interrupciones.' },
  { key: 'ciclos_conflicto',             titulo: 'Ciclos de conflicto',                 desc: 'Patrón repetitivo: queja → defensa → crítica → desprecio → evitación o escalada.' },
  { key: 'evitacion_conflicto_par',      titulo: 'Evitación del conflicto',             desc: 'No hablar de temas importantes por miedo a la pelea, acumulando resentimiento.' },
  { key: 'falta_neg_par_tcc',            titulo: 'Falta de habilidades de negociación', desc: 'No saber llegar a acuerdos, ceder siempre o imponer siempre.' },
  { key: 'dependencia_emocional_par_tcc', titulo: 'Dependencia emocional',             desc: 'Uno de los miembros necesita constantemente validación y presencia del otro para sentirse bien.' },
  { key: 'celos_control',                titulo: 'Celos y control',                     desc: 'Conductas de vigilancia, prohibiciones o revisión que reflejan creencias de inseguridad y desconfianza.' },
  { key: 'descalificacion_mutua',        titulo: 'Descalificación mutua',               desc: 'Costumbre de menospreciar los sentimientos, opiniones o logros del otro.' },
  { key: 'desequilibrio_poder',          titulo: 'Desequilibrio de poder',              desc: 'Uno domina y el otro se somete, generando resentimiento y distancia emocional.' },
  { key: 'historia_aprendizaje_rel_tcc', titulo: 'Historia de aprendizaje relacional',  desc: 'Patrones aprendidos en familias de origen que se repiten en la relación actual.' },
  { key: 'falta_reforzamiento',          titulo: 'Falta de reforzamiento positivo',     desc: 'Poca expresión de afecto, gratitud o reconocimiento hacia el otro.' },
]

export const PAR_PROTECCION_TCC: FactorItem[] = [
  { key: 'ambiente_colaborativo',        titulo: 'Ambiente colaborativo',               desc: 'Ver el conflicto como "nuestro problema" y no como "yo contra ti".' },
  { key: 'tareas_interaccion_pos',       titulo: 'Tareas conductuales de interacción positiva', desc: 'Ejercicios estructurados de interacción positiva.' },
  { key: 'entrenamiento_comunicacion',   titulo: 'Entrenamiento en comunicación',       desc: 'Aprender a expresar y escuchar, comprendiendo cómo los pensamientos automáticos interfieren.' },
  { key: 'identificacion_pa_par',        titulo: 'Identificación y modificación de pensamientos automáticos', desc: 'Detectar y cuestionar pensamientos negativos en situaciones de conflicto.' },
  { key: 'estrategias_conjuntas',        titulo: 'Estrategias conjuntas de resolución de problemas', desc: 'Aprender un método sistemático para resolver dificultades.' },
  { key: 'ajuste_creencias_par',         titulo: 'Ajuste del sistema de creencias',    desc: 'Identificar y modificar creencias rígidas y supuestos centrales sobre la relación.' },
  { key: 'prevencion_recaidas_par',      titulo: 'Prevención de recaídas',              desc: 'Anticipar problemas futuros y elaborar planes de afrontamiento.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de lookup
// ─────────────────────────────────────────────────────────────────────────────

type CaseType = 'individual' | 'familiar' | 'pareja'

const LOOKUP: Record<string, Record<CaseType, { riesgo: FactorItem[]; proteccion: FactorItem[] }>> = {
  famsis: {
    individual: { riesgo: IND_RIESGO_TFS,  proteccion: IND_PROTECCION_TFS  },
    familiar:   { riesgo: FAM_RIESGO_TFS,  proteccion: FAM_PROTECCION_TFS  },
    pareja:     { riesgo: PAR_RIESGO_TFS,  proteccion: PAR_PROTECCION_TFS  },
  },
  trec: {
    individual: { riesgo: IND_RIESGO_TREC, proteccion: IND_PROTECCION_TREC },
    familiar:   { riesgo: FAM_RIESGO_TREC, proteccion: FAM_PROTECCION_TREC },
    pareja:     { riesgo: PAR_RIESGO_TREC, proteccion: PAR_PROTECCION_TREC },
  },
  cc: {
    individual: { riesgo: IND_RIESGO_TCC,  proteccion: IND_PROTECCION_TCC  },
    familiar:   { riesgo: FAM_RIESGO_TCC,  proteccion: FAM_PROTECCION_TCC  },
    pareja:     { riesgo: PAR_RIESGO_TCC,  proteccion: PAR_PROTECCION_TCC  },
  },
}

/** Dado un schema, tipo de caso y array de keys activos, devuelve los FactorItem seleccionados. */
export function resolveFactores(
  schema: string,
  caseType: CaseType,
  tipo: 'riesgo' | 'proteccion',
  activeKeys: string[],
): FactorItem[] {
  const pool = LOOKUP[schema]?.[caseType]?.[tipo] ?? []
  return pool.filter(f => activeKeys.includes(f.key))
}
