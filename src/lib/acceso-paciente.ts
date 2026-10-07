// ─────────────────────────────────────────────────────────────
// Acceso por paciente — regla "la empresa paga"
//
//   - Paciente de empresa CONVENIO (empresa_id != null):
//       nivel Clínico, nunca bloqueado, no cuenta contra el límite.
//   - Paciente independiente (empresa_id = null):
//       nivel según el plan del terapeuta (bundle Companion → Clínico;
//       si no, subscriptions.tier). Solo los primeros N independientes
//       (por fecha de registro) tienen acceso, N = cupo del plan.
//       Sin plan → todos los independientes bloqueados.
//
// El registro de pacientes NUNCA se detiene por el límite; el límite se
// aplica después, en el acceso del terapeuta al expediente.
// Funciona con el cliente de navegador, de servidor o admin.
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'

/** Estados de suscripción que dan acceso (incluye el plan aprobado por el admin). */
export const ACCESS_STATUSES = ['active', 'trialing', 'free_approved']

export type Tier = 'esencial' | 'clinico'

export interface AccesoTerapeuta {
  /** Plan propio con acceso (pagado, prueba, aprobado por admin) o bundle Companion */
  tienePlan: boolean
  /** Ligado a al menos una empresa CONVENIO activa */
  tieneEmpresa: boolean
  /** Nivel con el que trabajan sus pacientes independientes */
  indepTier: Tier
  /** Cupo de pacientes independientes; null = sin límite */
  indepSlots: number | null
  /** Pacientes independientes activos (en orden de registro) */
  indepCount: number
  /** patient_ids independientes que sí tienen acceso */
  indepPermitidos: Set<string>
}

export async function getAccesoTerapeuta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  therapistId: string,
): Promise<AccesoTerapeuta> {
  const [subRes, bundleRes, empresaRes, indepRes] = await Promise.all([
    db.from('subscriptions')
      .select('status, tier, patient_slots')
      .eq('therapist_id', therapistId)
      .maybeSingle(),
    // Bundle Companion (empresa_id=null) cubre a los pacientes independientes
    db.from('therapist_slot_bundles')
      .select('patient_slots')
      .eq('therapist_id', therapistId)
      .eq('status', 'active')
      .is('empresa_id', null)
      .limit(1),
    db.from('therapist_empresa')
      .select('empresa_id, convenio_empresas(is_active)')
      .eq('therapist_id', therapistId),
    db.from('therapist_patients')
      .select('patient_id, created_at')
      .eq('therapist_id', therapistId)
      .eq('is_active', true)
      .is('empresa_id', null)
      .neq('status', 'archived')
      .order('created_at', { ascending: true }),
  ])

  const sub = subRes.data as { status: string; tier: string | null; patient_slots: number | null } | null
  const bundle = (bundleRes.data?.[0] ?? null) as { patient_slots: number } | null

  const tieneEmpresa = (empresaRes.data ?? []).some(r => {
    const e = r.convenio_empresas as { is_active?: boolean } | { is_active?: boolean }[] | null
    const emp = Array.isArray(e) ? e[0] : e
    return emp?.is_active === true
  })

  const subConAcceso = !!sub && ACCESS_STATUSES.includes(sub.status)
  const tienePlan = subConAcceso || !!bundle

  const indepTier: Tier = bundle || sub?.tier === 'clinico' ? 'clinico' : 'esencial'
  const indepSlots: number | null = bundle
    ? bundle.patient_slots
    : subConAcceso ? (sub?.patient_slots ?? null) : 0

  const indepIds = (indepRes.data ?? []).map(r => r.patient_id as string)
  const permitidos = !tienePlan
    ? []
    : indepSlots === null ? indepIds : indepIds.slice(0, indepSlots)

  return {
    tienePlan,
    tieneEmpresa,
    indepTier,
    indepSlots,
    indepCount: indepIds.length,
    indepPermitidos: new Set(permitidos),
  }
}

/** Nivel y bloqueo de un paciente concreto según el acceso del terapeuta. */
export function accesoDePaciente(
  acceso: AccesoTerapeuta,
  patientId: string,
  empresaId: string | null,
): { tier: Tier; bloqueado: boolean } {
  if (empresaId) return { tier: 'clinico', bloqueado: false }
  return { tier: acceso.indepTier, bloqueado: !acceso.indepPermitidos.has(patientId) }
}
