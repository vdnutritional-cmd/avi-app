// Administración Institucional AVI — empresas disponibles y selección común
// (la selección viaja en ?empresaIds= entre Panel, Reporte General y Reporte por Terapeuta).
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarTerminologia, terminologiaComun, type Terminologia } from '@/lib/terminologia'

export interface EmpresaAVI { id: string; nombre: string; logo_url: string | null; terminologia: Terminologia }

/** Opción "Sin empresa" del selector: pacientes independientes (empresa_id = null). */
export const SIN_EMPRESA = 'sin-empresa'

/** Empresas en CONVENIO activas (el superadmin las ve todas, como N1). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cargarEmpresasAVI(admin: SupabaseClient<any, any, any>): Promise<EmpresaAVI[]> {
  const { data } = await admin
    .from('convenio_empresas')
    .select('id, nombre, logo_url, terminologia')
    .eq('is_active', true)
    .order('nombre', { ascending: true })
  return (data ?? []).map(e => ({
    id: e.id as string, nombre: e.nombre as string, logo_url: (e.logo_url as string | null) ?? null,
    terminologia: normalizarTerminologia(e.terminologia),
  }))
}

/** Una sola palabra para varias empresas: 'asesorado' si alguna lo es (misma política que el menú del terapeuta) */
export function palabraDeEmpresas(empresas: { terminologia: Terminologia }[]): Terminologia {
  return terminologiaComun(empresas.map(e => e.terminologia))
}

/**
 * Sin parámetro → todas las empresas + "Sin empresa" (entrada desde el menú).
 * `empresaIds=` vacío → ninguna (el usuario desmarcó todo).
 * Solo ids de empresas existentes o SIN_EMPRESA (nunca confiar en la URL).
 * Los reportes ignoran SIN_EMPRESA (solo aceptan ids de empresas).
 */
export function resolverSeleccion(empresas: EmpresaAVI[], empresaIdsParam: string | undefined): string[] {
  if (empresaIdsParam === undefined) return [...empresas.map(e => e.id), SIN_EMPRESA]
  return empresaIdsParam.split(',').filter(id => id === SIN_EMPRESA || empresas.some(e => e.id === id))
}

export interface TerapeutaIndependientes {
  therapistId: string
  nombre: string
  email: string
  pacientes: { id: string; nombre: string }[]
}

/**
 * Pacientes activos SIN empresa (independientes) agrupados por terapeuta.
 * Mismo criterio de "activo" que el Panel Institucional (therapist_patients.is_active).
 * Excluye terapeutas desactivados (profiles.is_active=false).
 */
export async function cargarIndependientes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
): Promise<TerapeutaIndependientes[]> {
  const { data: rows } = await admin
    .from('therapist_patients')
    .select('therapist_id, patient_id, profiles!therapist_patients_patient_id_fkey(full_name, email)')
    .is('empresa_id', null)
    .eq('is_active', true)
    .neq('status', 'archived')

  const porTerapeuta = new Map<string, { id: string; nombre: string }[]>()
  for (const r of rows ?? []) {
    const pp = r.profiles as { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null
    const p = Array.isArray(pp) ? pp[0] : pp
    const lista = porTerapeuta.get(r.therapist_id as string) ?? []
    lista.push({ id: r.patient_id as string, nombre: p?.full_name ?? p?.email ?? (r.patient_id as string) })
    porTerapeuta.set(r.therapist_id as string, lista)
  }
  if (porTerapeuta.size === 0) return []

  const { data: terapeutas } = await admin
    .from('profiles')
    .select('id, full_name, email, is_active')
    .in('id', [...porTerapeuta.keys()])

  return (terapeutas ?? [])
    .filter(t => t.is_active !== false)
    .map(t => ({
      therapistId: t.id as string,
      nombre: (t.full_name as string | null) ?? 'Sin nombre',
      email: (t.email as string | null) ?? '',
      pacientes: porTerapeuta.get(t.id as string) ?? [],
    }))
}
