// ─────────────────────────────────────────────────────────────
// CentrosAtención (7 nov 2026, migración 20261107): carpetas de una empresa en CONVENIO.
//   - Los crea la Persona Institucional User/Superuser (o el superadmin) en Configuración Admin.
//   - Les asigna sus terapeutas en Alta/Baja de <Pros> (un terapeuta puede estar en varios).
//   - La persona atendida queda en uno: therapist_patients.centro_id (lo elige el terapeuta en
//     Asignación a Institución; si el terapeuta tiene un solo CentroAtención en esa empresa, se pone solo).
// Los reportes de Administración filtran con el parámetro `centros` de la URL. Solo servidor.
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

export interface CentroAtencion { id: string; empresa_id: string; nombre: string; is_active: boolean }

/** Valor del filtro para las personas sin CentroAtención */
export const SIN_CENTRO = 'sin'

/** CentrosAtención de unas empresas, por nombre (activos e inactivos: los reportes conservan la historia) */
export async function cargarCentros(admin: Db, empresaIds: string[]): Promise<CentroAtencion[]> {
  if (empresaIds.length === 0) return []
  const { data, error } = await admin
    .from('empresa_centros_atencion')
    .select('id, empresa_id, nombre, is_active')
    .in('empresa_id', empresaIds)
    .order('nombre')
  if (error) { console.error('[cargarCentros]', error.message); return [] }
  return (data ?? []) as CentroAtencion[]
}

/** Centros de cada terapeuta (therapist_id → ids de centro) dentro de los centros dados */
export async function centrosDeTerapeutas(admin: Db, centroIds: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>()
  if (centroIds.length === 0) return mapa
  const { data } = await admin.from('therapist_centro_atencion').select('therapist_id, centro_id').in('centro_id', centroIds)
  for (const r of data ?? []) mapa.set(r.therapist_id, [...(mapa.get(r.therapist_id) ?? []), r.centro_id])
  return mapa
}

/**
 * CentroAtención que le toca a una persona nueva (o al cambiar de empresa):
 * el único CentroAtención activo del terapeuta en esa empresa; con varios o ninguno, null.
 */
export async function centroPorDefecto(admin: Db, therapistId: string, empresaId: string | null): Promise<string | null> {
  if (!empresaId) return null
  const { data } = await admin
    .from('therapist_centro_atencion')
    .select('centro_id, empresa_centros_atencion!inner(empresa_id, is_active)')
    .eq('therapist_id', therapistId)
    .eq('empresa_centros_atencion.empresa_id', empresaId)
    .eq('empresa_centros_atencion.is_active', true)
  return data && data.length === 1 ? (data[0].centro_id as string) : null
}

/** Filtro de la URL (`centros=id1,id2,sin`) validado contra los centros permitidos. [] = todos */
export function resolverCentros(param: string | undefined, centros: CentroAtencion[]): string[] {
  const pedidos = (param ?? '').split(',').filter(Boolean)
  return pedidos.filter(id => id === SIN_CENTRO || centros.some(c => c.id === id))
}

/** ¿La relación (therapist_patients) entra en el filtro de CentrosAtención? */
export function enCentros(centroId: string | null | undefined, seleccion: string[]): boolean {
  if (seleccion.length === 0) return true
  return centroId ? seleccion.includes(centroId) : seleccion.includes(SIN_CENTRO)
}

/** Texto del filtro para encabezados y PDF: "Valora Sur + Valora Misión" */
export function etiquetaCentros(seleccion: string[], centros: CentroAtencion[]): string | null {
  if (seleccion.length === 0) return null
  return seleccion.map(id => id === SIN_CENTRO ? 'Sin CentroAtención' : centros.find(c => c.id === id)?.nombre ?? '').filter(Boolean).join(' + ')
}

/** Al dar de baja a un terapeuta de una empresa: sale de sus CentrosAtención (sus personas se quedan en ellos) */
export async function quitarDeCentrosDeEmpresa(admin: Db, therapistId: string, empresaId: string): Promise<void> {
  const { data: centros } = await admin.from('empresa_centros_atencion').select('id').eq('empresa_id', empresaId)
  if (!centros?.length) return
  const { error } = await admin.from('therapist_centro_atencion').delete()
    .eq('therapist_id', therapistId).in('centro_id', centros.map(c => c.id as string))
  if (error) console.error('[quitarDeCentrosDeEmpresa]', error.message)
}

export interface CentroConConteo extends CentroAtencion { pros: number; personas: number }

/** Para Configuración Admin: cada CentroAtención con sus terapeutas y personas activas */
export async function cargarCentrosConConteo(admin: Db, empresaIds: string[]): Promise<CentroConConteo[]> {
  const centros = await cargarCentros(admin, empresaIds)
  if (centros.length === 0) return []
  const ids = centros.map(c => c.id)
  const [porTerapeuta, { data: personas }] = await Promise.all([
    centrosDeTerapeutas(admin, ids),
    admin.from('therapist_patients').select('centro_id').in('centro_id', ids).eq('is_active', true).neq('status', 'archived'),
  ])
  return centros.map(c => ({
    ...c,
    pros: [...porTerapeuta.values()].filter(lista => lista.includes(c.id)).length,
    personas: (personas ?? []).filter(p => p.centro_id === c.id).length,
  }))
}
