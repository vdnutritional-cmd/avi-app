// Catálogo de enfoques terapéuticos (Sprint 24, Multi-RAG). Fuente única de nombres y descripciones.
// `profiles.therapy_profile` guarda 1 o 2 ids ordenados y unidos con "_": 'famsis', 'famsis_trec', 'cc_trec'…
// Los libros de cada enfoque están en src/lib/rag/retrieve-chunks.ts (ENFOQUES).

export type EnfoqueId = 'famsis' | 'trec' | 'cc'

export const ENFOQUES_CATALOGO: { id: EnfoqueId; label: string; corto: string; descripcion: string; icon: string }[] = [
  {
    id: 'famsis',
    label: 'Terapia Familiar Sistémica',
    corto: 'Terapia Familiar Sistémica',
    descripcion: 'Enfoque que ve a la familia como un sistema interconectado donde el síntoma de un miembro refleja desequilibrios relacionales del sistema completo.',
    icon: '🏠',
  },
  {
    id: 'trec',
    label: 'Terapia Racional Emotivo-Conductual (TREC)',
    corto: 'TREC',
    descripcion: 'Terapia cognitiva que sostiene que las emociones perturbadoras derivan de creencias irracionales, las cuales se identifican y sustituyen por otras más racionales.',
    icon: '🧠',
  },
  {
    id: 'cc',
    label: 'Terapia Cognitivo-Conductual (TCC)',
    corto: 'Cognitivo-Conductual',
    descripcion: 'Modelo que integra técnicas cognitivas y conductuales, partiendo de que pensamientos, emociones y conductas se interrelacionan y modifican patrones disfuncionales.',
    icon: '💡',
  },
]

export const TODOS_LOS_ENFOQUES: EnfoqueId[] = ENFOQUES_CATALOGO.map(e => e.id)

/** Máximo de enfoques que opera un terapeuta a la vez */
export const MAX_ENFOQUES = 2

export function esEnfoque(v: unknown): v is EnfoqueId {
  return typeof v === 'string' && (TODOS_LOS_ENFOQUES as string[]).includes(v)
}

/** ['trec','famsis'] → 'famsis_trec' (null si no hay ninguno) */
export function perfilDeEnfoques(seleccion: EnfoqueId[]): string | null {
  const unicos = [...new Set(seleccion)].sort()
  return unicos.length ? unicos.join('_') : null
}

/** 'famsis_trec' → ['famsis','trec'] */
export function enfoquesDePerfil(perfil: string | null | undefined): EnfoqueId[] {
  return (perfil ?? '').split('_').filter(esEnfoque)
}

/** 'famsis_trec' → 'Terapia Familiar Sistémica + TREC' */
export function nombrePerfil(perfil: string | null | undefined): string {
  const ids = enfoquesDePerfil(perfil)
  if (ids.length === 1) return ENFOQUES_CATALOGO.find(e => e.id === ids[0])!.label
  return ids.map(id => ENFOQUES_CATALOGO.find(e => e.id === id)!.corto).join(' + ')
}
