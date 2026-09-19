import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AuditoriaClient from './AuditoriaClient'

export const dynamic = 'force-dynamic'

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const { desde, hasta } = await searchParams

  const supabase = await createClient()
  const admin    = createAdminClient()

  // 1. Cargar registros con filtro de fecha en servidor (límite aplica dentro del rango)
  let query = supabase
    .from('audit_log')
    .select('id, usuario_id, operacion, tabla, registro_id, datos_antes, datos_despues, created_at')
    .order('created_at', { ascending: false })

  if (desde) query = query.gte('created_at', desde)
  if (hasta) query = query.lte('created_at', `${hasta}T23:59:59`)

  const { data: rawLogs } = await query.limit(500)

  // 2. Join de perfiles de usuarios (quien hizo la acción)
  const userIds = [...new Set(
    (rawLogs ?? []).map(l => l.usuario_id).filter(Boolean) as string[]
  )]

  const { data: userProfiles } = userIds.length > 0
    ? await admin.from('profiles').select('id, email, role, full_name').in('id', userIds)
    : { data: [] as { id: string; email: string | null; role: string | null; full_name: string | null }[] }

  const profileMap = Object.fromEntries(
    (userProfiles ?? []).map(p => [p.id, { email: p.email ?? '', role: p.role ?? '', full_name: p.full_name ?? '' }])
  )

  // 3. Extraer patient_ids del JSONB para mostrar nombre del paciente
  const patientIdSet = new Set<string>()
  for (const l of rawLogs ?? []) {
    const pid_d = (l.datos_despues as Record<string, unknown> | null)?.patient_id as string | undefined
    const pid_a = (l.datos_antes   as Record<string, unknown> | null)?.patient_id as string | undefined
    if (pid_d) patientIdSet.add(pid_d)
    if (pid_a) patientIdSet.add(pid_a)
  }
  const patientIds = [...patientIdSet]

  const { data: patientProfiles } = patientIds.length > 0
    ? await admin.from('profiles').select('id, full_name, email').in('id', patientIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] }

  const pacientes: Record<string, string> = Object.fromEntries(
    (patientProfiles ?? []).map(p => [p.id, p.full_name ?? p.email ?? p.id])
  )

  // 4. Join manual
  const logs = (rawLogs ?? []).map(l => ({
    ...l,
    profiles: l.usuario_id ? (profileMap[l.usuario_id] ?? null) : null,
  }))

  return (
    <AuditoriaClient
      logs={logs}
      pacientes={pacientes}
      desde={desde ?? ''}
      hasta={hasta ?? ''}
    />
  )
}
