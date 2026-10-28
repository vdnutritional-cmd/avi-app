// Fusión de la cuenta temporal de una persona con su cuenta real (26 oct 2026).
// Antes solo copiaba la nota inicial y movía las sesiones presenciales; los Datos Generales
// se quedaban en la temporal y, si las dos tenían "Sesión 1", las sesiones no se movían
// (choque de número) sin avisar. Ahora se conserva toda la información:
//   - Nota inicial, expediente y derivaciones/cierres: campo por campo; si la real ya tiene
//     el dato, se respeta el de la real.
//   - Sesiones presenciales: se juntan las de ambas y se numeran por fecha (la más antigua = 1).
//   - Análisis, cuestionarios y mensajes al paciente: pasan a la real.
// Solo servidor: usa el cliente admin; quien llama ya validó que ambas cuentas son del terapeuta.
import type { createAdminClient } from '@/lib/supabase/admin'

type Db = ReturnType<typeof createAdminClient>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = Record<string, any>

// Columnas que identifican la fila; nunca se copian
const LLAVES = new Set(['id', 'therapist_id', 'patient_id', 'created_at', 'updated_at'])

/** Vacío: null, texto en blanco, o lista/objeto cuyos elementos están todos vacíos (p. ej. hijos sin capturar). */
function vacio(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.every(vacio)
  if (typeof v === 'object') return Object.values(v as Fila).every(vacio)
  return false
}

/** Campos que la real tiene vacíos y la temporal no: se toman de la temporal. */
function camposFaltantes(origen: Fila, destino: Fila, incluir: (k: string) => boolean = () => true): Fila {
  return Object.fromEntries(Object.entries(origen).filter(([k, v]) =>
    !LLAVES.has(k) && incluir(k) && !vacio(v) && vacio(destino[k])
  ))
}

export interface ResultadoFusion {
  notaInicial: number        // campos de la nota inicial tomados de la temporal
  expediente: number         // campos del expediente tomados de la temporal (o todos si la real no tenía)
  sesiones: number           // sesiones presenciales en la real después de fusionar
  sesionesMovidas: number
  analisis: number
  cuestionarios: number
}

export async function fusionarCuentas(
  admin: Db, therapistId: string, origenId: string, destinoId: string,
): Promise<ResultadoFusion> {
  const deTerapeuta = (tabla: string, patientId: string) =>
    admin.from(tabla).select('*').eq('therapist_id', therapistId).eq('patient_id', patientId)
  const falla = (paso: string, e: { message: string } | null) => {
    if (e) throw new Error(`${paso}: ${e.message}`)
  }

  // ── 1. Nota inicial (vive en therapist_patients) ──
  const [{ data: tpO, error: eTpO }, { data: tpD, error: eTpD }] = await Promise.all([
    deTerapeuta('therapist_patients', origenId).maybeSingle(),
    deTerapeuta('therapist_patients', destinoId).maybeSingle(),
  ])
  falla('Nota inicial', eTpO ?? eTpD)
  if (!tpO || !tpD) throw new Error('No se encontraron las dos cuentas en tu lista')
  const nota = camposFaltantes(tpO, tpD, k => k.startsWith('initial_note'))
  if (Object.keys(nota).length) {
    const { error } = await admin.from('therapist_patients').update(nota).eq('id', tpD.id)
    falla('Nota inicial', error)
  }

  // ── 2. Filas únicas por persona: expediente (Datos Generales y AVI-CLÍNICO) y derivaciones/cierres ──
  async function combinarFilaUnica(tabla: string, omitir?: (f: Fila) => boolean): Promise<number> {
    const [{ data: o, error: e1 }, { data: d, error: e2 }] = await Promise.all([
      deTerapeuta(tabla, origenId).maybeSingle(),
      deTerapeuta(tabla, destinoId).maybeSingle(),
    ])
    falla(tabla, e1 ?? e2)
    if (!o || omitir?.(o)) return 0
    if (!d) {
      const { id: _id, created_at: _c, ...resto } = o
      const { error } = await admin.from(tabla).insert({ ...resto, patient_id: destinoId })
      falla(tabla, error)
      return Object.keys(camposFaltantes(o, {})).length
    }
    const faltan = camposFaltantes(o, d)
    if (Object.keys(faltan).length) {
      const { error } = await admin.from(tabla).update(faltan).eq('id', d.id)
      falla(tabla, error)
    }
    return Object.keys(faltan).length
  }
  const expediente = await combinarFilaUnica('patient_expediente')
  // El abandono que marca el cron por inactividad es de la cuenta temporal, no de la persona
  await combinarFilaUnica('patient_derivaciones_cierres', f => f.abandono === true)

  // ── 3. Sesiones presenciales: juntas, por fecha, numeradas de nuevo ──
  const [{ data: sO, error: eSO }, { data: sD, error: eSD }] = await Promise.all([
    deTerapeuta('therapist_session_notes', origenId),
    deTerapeuta('therapist_session_notes', destinoId),
  ])
  falla('Sesiones presenciales', eSO ?? eSD)
  const todas = [...(sO ?? []), ...(sD ?? [])].sort((a, b) =>
    (a.session_date ?? '9999').localeCompare(b.session_date ?? '9999') ||
    (a.created_at ?? '').localeCompare(b.created_at ?? '')
  )
  // Dos pasadas: primero números provisionales que no chocan con ninguno, luego los definitivos
  for (const [paso, numero] of [['provisional', (i: number) => 100000 + i], ['definitivo', (i: number) => i + 1]] as const) {
    for (const [i, s] of todas.entries()) {
      const { error } = await admin.from('therapist_session_notes')
        .update({ patient_id: destinoId, session_number: numero(i) })
        .eq('id', s.id)
      falla(`Sesiones presenciales (${paso})`, error)
    }
  }

  // ── 4. Análisis y cuestionarios: pasan a la real ──
  async function mover(tabla: string): Promise<number> {
    const { data, error } = await admin.from(tabla)
      .update({ patient_id: destinoId })
      .eq('therapist_id', therapistId).eq('patient_id', origenId)
      .select('id')
    falla(tabla, error)
    return data?.length ?? 0
  }
  const analisis = await mover('analyses')
  const cuestionarios = await mover('patient_questionnaires')
  await mover('patient_mensajes')   // mensajes al paciente (27 oct 2026)

  // ── 5. Archivar la temporal ──
  const { error: eArch } = await admin.from('therapist_patients')
    .update({ status: 'archived', is_active: false })
    .eq('id', tpO.id)
  falla('Archivar la cuenta temporal', eArch)

  return {
    notaInicial: Object.keys(nota).length,
    expediente,
    sesiones: todas.length,
    sesionesMovidas: sO?.length ?? 0,
    analisis,
    cuestionarios,
  }
}
