// Carga de terapeutas y pacientes activos de una empresa para el Panel Institucional.
// Fuente única para Administración Institucional (Persona Institucional) y
// Administración Institucional AVI (superadmin). Solo servidor (cliente admin).
import type { SupabaseClient } from '@supabase/supabase-js'
import { cargarCentros, centrosDeTerapeutas } from '@/lib/centros-atencion'

export interface PacienteItem { id: string; nombre: string; /** CentroAtención (null = sin CentroAtención) */ centro: string | null }

export interface TerapeutaRow {
  therapistId: string
  nombre: string
  email: string
  telefono: string
  empresa: string
  /** true si ya NO está en therapist_empresa pero aún tiene pacientes activos */
  isHuerfano: boolean
  pacientes: PacienteItem[]
  pacientesActivos: number
  /** CentrosAtención de la empresa a los que está asignado (nombres) */
  centros: string[]
}

/** Resumen por CentroAtención de una empresa para el Panel (7 nov 2026) */
export interface CentroResumen { nombre: string; activo: boolean; pros: number; personas: number }

/**
 * Resumen por CentroAtención: <pros> asignados y personas activas de cada uno, más una fila
 * "Sin CentroAtención" si hay personas sin él. Vacío si la empresa no tiene CentrosAtención.
 */
export async function cargarResumenCentros(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  empresaId: string,
  terapeutas: TerapeutaRow[],
): Promise<CentroResumen[]> {
  const centros = await cargarCentros(admin, [empresaId])
  if (centros.length === 0) return []
  const personas = terapeutas.flatMap(t => t.pacientes)
  const filas: CentroResumen[] = centros
    .map(c => ({
      nombre: c.nombre,
      activo: c.is_active,
      pros: terapeutas.filter(t => t.centros.includes(c.nombre)).length,
      personas: personas.filter(p => p.centro === c.nombre).length,
    }))
    .filter(f => f.activo || f.personas > 0)
  const sin = personas.filter(p => !p.centro).length
  if (sin > 0) filas.push({ nombre: 'Sin CentroAtención', activo: true, pros: terapeutas.filter(t => t.centros.length === 0).length, personas: sin })
  return filas
}

/** Teléfonos (WhatsApp) de los terapeutas, desde auth user_metadata */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cargarTelefonos(admin: SupabaseClient<any, any, any>): Promise<Map<string, string>> {
  const { data: authUsersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const whatsappMap = new Map<string, string>()
  for (const u of authUsersData?.users ?? []) {
    const phone = u.user_metadata?.whatsapp_phone
    if (phone) whatsappMap.set(u.id, String(phone))
  }
  return whatsappMap
}

export async function cargarTerapeutasEmpresa(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  empresaId: string,
  empresaNombre: string,
  whatsappMap: Map<string, string>,
): Promise<TerapeutaRow[]> {
  // Fuente 1: terapeutas registrados en therapist_empresa para esta empresa
  const { data: empresaRels } = await admin
    .from('therapist_empresa')
    .select('therapist_id, profiles!therapist_id(full_name, email, is_active)')
    .eq('empresa_id', empresaId)

  // Fuente 2: PIs con opera_como_terapeuta=true (pueden ser terapeutas activos
  // de la empresa que aún no están en therapist_empresa)
  const { data: piTerapeutas } = await admin
    .from('convenio_personas_institucionales')
    .select('therapist_id, profiles!therapist_id(full_name, email, is_active)')
    .eq('empresa_id', empresaId)
    .eq('opera_como_terapeuta', true)
    .eq('is_active', true)

  // Ids que vienen de therapist_empresa (Fuente 1) — para detectar huérfanos
  const empresaRelIds = new Set((empresaRels ?? []).map(r => r.therapist_id as string))

  // Unión deduplicada por therapist_id — excluir perfiles desactivados (is_active=false)
  type TerapeutaEntry = { therapist_id: string; profiles: { full_name?: string; email?: string; is_active?: boolean } | null }
  const therapistMap = new Map<string, TerapeutaEntry>()
  for (const r of [...(empresaRels ?? []), ...(piTerapeutas ?? [])]) {
    const prof = r.profiles as { full_name?: string; email?: string; is_active?: boolean } | null
    if (prof?.is_active === false) continue  // terapeuta desactivado por admin
    if (!therapistMap.has(r.therapist_id as string)) {
      therapistMap.set(r.therapist_id as string, {
        therapist_id: r.therapist_id as string,
        profiles: prof,
      })
    }
  }

  // CentrosAtención de la empresa y de cada terapeuta (7 nov 2026)
  const centros = await cargarCentros(admin, [empresaId])
  const nombreCentro = new Map(centros.map(c => [c.id, c.nombre]))
  const centrosPorPro = await centrosDeTerapeutas(admin, centros.map(c => c.id))

  // Pacientes activos (con nombre) por terapeuta + empresa
  return Promise.all(
    Array.from(therapistMap.values()).map(async (t) => {
      const p = t.profiles as { full_name?: string; email?: string } | null
      const { data: tpRows } = await admin
        .from('therapist_patients')
        .select('patient_id, centro_id, profiles!therapist_patients_patient_id_fkey(full_name, email)')
        .eq('therapist_id', t.therapist_id)
        .eq('empresa_id', empresaId)
        .eq('is_active', true)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pacientes: PacienteItem[] = (tpRows ?? []).map((row: any) => {
        const pp = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
          id:     row.patient_id as string,
          nombre: pp?.full_name ?? pp?.email ?? row.patient_id,
          centro: row.centro_id ? nombreCentro.get(row.centro_id) ?? null : null,
        }
      })

      const isHuerfano = !empresaRelIds.has(t.therapist_id) && pacientes.length > 0

      return {
        therapistId:      t.therapist_id,
        nombre:           p?.full_name ?? 'Sin nombre',
        email:            p?.email     ?? '',
        telefono:         whatsappMap.get(t.therapist_id) ?? '',
        empresa:          empresaNombre,
        isHuerfano,
        pacientes,
        pacientesActivos: pacientes.length,
        centros: (centrosPorPro.get(t.therapist_id) ?? []).map(id => nombreCentro.get(id) ?? '').filter(Boolean).sort(),
      }
    })
  )
}
