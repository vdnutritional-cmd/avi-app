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

  // 1. Cargar los últimos 500 registros con filtro de fecha en servidor
  let query = supabase
    .from('audit_log')
    .select('id, usuario_id, operacion, tabla, registro_id, datos_antes, datos_despues, created_at')
    .order('created_at', { ascending: false })

  if (desde) {
    query = query.gte('created_at', desde)
  }
  if (hasta) {
    query = query.lte('created_at', `${hasta}T23:59:59`)
  }

  const { data: rawLogs } = await query.limit(500)

  // 2. Obtener los perfiles de los usuarios que aparecen en los registros
  const userIds = [...new Set(
    (rawLogs ?? []).map(l => l.usuario_id).filter(Boolean) as string[]
  )]

  const { data: profiles } = userIds.length > 0
    ? await admin.from('profiles').select('id, email, role').in('id', userIds)
    : { data: [] as { id: string; email: string | null; role: string | null }[] }

  const profileMap = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, { email: p.email ?? '', role: p.role ?? '' }])
  )

  // 3. Join manual servidor
  const logs = (rawLogs ?? []).map(l => ({
    ...l,
    profiles: profileMap[l.usuario_id] ?? null,
  }))

  return <AuditoriaClient logs={logs} desde={desde ?? ''} hasta={hasta ?? ''} />
}
