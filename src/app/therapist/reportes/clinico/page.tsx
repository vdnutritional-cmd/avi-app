// ─────────────────────────────────────────────────────────────
// /therapist/reportes/clinico — Reportes AVI-CLÍNICO (E7)
// Server component
// ─────────────────────────────────────────────────────────────
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ClinicoClient from './ClinicoClient'

export const dynamic = 'force-dynamic'

export default async function ClinicoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const therapistId = user.id
  const admin = createAdminClient()

  // Nombre del terapeuta
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', therapistId)
    .single()
  const terapeutaNombre = profile?.full_name || profile?.email || user.email || 'Terapeuta'

  // Tier
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('therapist_id', therapistId)
    .maybeSingle()
  const tier = (sub?.tier as string | null) ?? null

  // Empresas con logo
  const { data: empresaRels } = await admin
    .from('therapist_empresa')
    .select('empresa_id, convenio_empresas(nombre, logo_url)')
    .eq('therapist_id', therapistId)
  const empresas = (empresaRels ?? []).map(r => {
    const e = r.convenio_empresas as { nombre?: string; logo_url?: string | null } | null
    return { id: r.empresa_id as string, nombre: e?.nombre ?? '', logo_url: e?.logo_url ?? null }
  })

  // Lista de pacientes no archivados
  const { data: relaciones } = await admin
    .from('therapist_patients')
    .select('patient_id, is_active')
    .eq('therapist_id', therapistId)
    .neq('status', 'archived')

  const pacienteIds = (relaciones ?? []).map(r => r.patient_id as string)
  const { data: profiles } = pacienteIds.length > 0
    ? await admin.from('profiles').select('id, full_name, email').in('id', pacienteIds)
    : { data: [] }

  const activoSet = new Set(
    (relaciones ?? []).filter(r => r.is_active).map(r => r.patient_id as string)
  )

  const pacientes = (profiles ?? [])
    .map(p => ({ id: p.id, nombre: p.full_name ?? p.email ?? p.id, activo: activoSet.has(p.id) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <ClinicoClient
      terapeutaNombre={terapeutaNombre as string}
      tier={tier}
      empresas={empresas}
      pacientes={pacientes}
    />
  )
}
