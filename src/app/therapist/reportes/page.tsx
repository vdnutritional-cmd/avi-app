// ─────────────────────────────────────────────────────────────
// /therapist/reportes — Reportes Terapéuticos (E4)
// Server component: fetch pacientes + tier → ReportesClient
// Sprint 10 (Cambio XII)
// ─────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ReportesClient from './ReportesClient'

export const dynamic = 'force-dynamic'

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const therapistId = user.id
  const admin       = createAdminClient()

  // Datos del terapeuta
  const { data: therapistProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', therapistId)
    .single()
  const terapeutaNombre = therapistProfile?.full_name || therapistProfile?.email || user.email || 'Terapeuta'

  // Tier del terapeuta
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('therapist_id', therapistId)
    .maybeSingle()
  const tier = (sub?.tier as string | null) ?? null

  // Logo de la empresa CONVENIO del terapeuta (si tiene una empresa asignada)
  const { data: empresaRel } = await admin
    .from('therapist_empresa')
    .select('empresa_id, convenio_empresas(logo_url)')
    .eq('therapist_id', therapistId)
    .limit(1)
    .maybeSingle()

  const logoUrl = (empresaRel?.convenio_empresas as { logo_url?: string | null } | null)?.logo_url ?? null

  // Lista de pacientes activos (para selector)
  const { data: relaciones } = await admin
    .from('therapist_patients')
    .select('patient_id, is_active')
    .eq('therapist_id', therapistId)
    .neq('status', 'archived')
    .order('patient_id')

  const pacienteIds = (relaciones ?? []).map(r => r.patient_id as string)

  const { data: profiles } = pacienteIds.length > 0
    ? await admin.from('profiles').select('id, full_name, email').in('id', pacienteIds)
    : { data: [] }

  const activoSet = new Set(
    (relaciones ?? []).filter(r => r.is_active).map(r => r.patient_id as string)
  )

  const pacientes = (profiles ?? [])
    .map(p => ({
      id:     p.id,
      nombre: p.full_name ?? p.email ?? p.id,
      activo: activoSet.has(p.id),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <ReportesClient
      terapeutaNombre={terapeutaNombre as string}
      tier={tier}
      logoUrl={logoUrl}
      pacientes={pacientes}
    />
  )
}
