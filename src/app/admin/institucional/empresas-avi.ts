// Administración Institucional AVI — empresas disponibles y selección común
// (la selección viaja en ?empresaIds= entre Panel, Reporte General y Reporte por Terapeuta).
import type { SupabaseClient } from '@supabase/supabase-js'

export interface EmpresaAVI { id: string; nombre: string; logo_url: string | null }

/** Empresas en CONVENIO activas (el superadmin las ve todas, como N1). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cargarEmpresasAVI(admin: SupabaseClient<any, any, any>): Promise<EmpresaAVI[]> {
  const { data } = await admin
    .from('convenio_empresas')
    .select('id, nombre, logo_url')
    .eq('is_active', true)
    .order('nombre', { ascending: true })
  return (data ?? []).map(e => ({ id: e.id as string, nombre: e.nombre as string, logo_url: (e.logo_url as string | null) ?? null }))
}

/**
 * Sin parámetro → todas las empresas (entrada desde el menú).
 * `empresaIds=` vacío → ninguna (el usuario desmarcó todo).
 * Solo ids de empresas existentes (nunca confiar en la URL).
 */
export function resolverSeleccion(empresas: EmpresaAVI[], empresaIdsParam: string | undefined): string[] {
  if (empresaIdsParam === undefined) return empresas.map(e => e.id)
  return empresaIdsParam.split(',').filter(id => empresas.some(e => e.id === id))
}
