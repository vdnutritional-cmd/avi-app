// ─────────────────────────────────────────────────────────────
// SubCarpetas del terapeuta (7 nov 2026, migración 20261107).
//   - Cualquier terapeuta (con o sin empresa, plan pagado o gratis) las crea en Mis <users>
//     y pone en cada una a sus personas (therapist_patients.subcarpeta_id). Un solo nivel.
//   - Privadas: solo las ve su terapeuta (la empresa ve sus CentrosAtención, no esto).
//   - Mi estadística y Mis Asesorías filtran con el parámetro `subcarpetas` de la URL.
// Solo servidor.
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

export interface Subcarpeta { id: string; nombre: string }

/** Valor del filtro para las personas sin SubCarpeta */
export const SIN_SUBCARPETA = 'sin'

export async function cargarSubcarpetas(admin: Db, therapistId: string): Promise<Subcarpeta[]> {
  const { data, error } = await admin.from('therapist_subcarpetas').select('id, nombre')
    .eq('therapist_id', therapistId).order('nombre')
  if (error) { console.error('[cargarSubcarpetas]', error.message); return [] }
  return (data ?? []) as Subcarpeta[]
}

/** Filtro de la URL (`subcarpetas=id1,sin`) validado contra las SubCarpetas del terapeuta. [] = todas */
export function resolverSubcarpetas(param: string | undefined, lista: Subcarpeta[]): string[] {
  return (param ?? '').split(',').filter(id => id === SIN_SUBCARPETA || lista.some(s => s.id === id))
}

/**
 * Personas del terapeuta que entran en el filtro (patient_id), o null si no hay filtro.
 * Incluye archivadas e inactivas: los reportes del periodo también las cuentan.
 */
export async function personasEnSubcarpetas(admin: Db, therapistId: string, seleccion: string[]): Promise<Set<string> | null> {
  if (seleccion.length === 0) return null
  const { data } = await admin.from('therapist_patients').select('patient_id, subcarpeta_id').eq('therapist_id', therapistId)
  return new Set((data ?? [])
    .filter(r => r.subcarpeta_id ? seleccion.includes(r.subcarpeta_id as string) : seleccion.includes(SIN_SUBCARPETA))
    .map(r => r.patient_id as string))
}

/** Texto del filtro para encabezados y PDF */
export function etiquetaSubcarpetas(seleccion: string[], lista: Subcarpeta[]): string | null {
  if (seleccion.length === 0) return null
  return seleccion.map(id => id === SIN_SUBCARPETA ? 'Sin SubCarpeta' : lista.find(s => s.id === id)?.nombre ?? '').filter(Boolean).join(' + ')
}
