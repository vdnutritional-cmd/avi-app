import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ReportesPageClient from './ReportesPageClient'
import { getTerminologiaTerapeuta } from '@/lib/terminologia-paciente'

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const [{ data: profile }, { data: subscription }, terminologia] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
    supabase.from('subscriptions').select('tier').eq('therapist_id', user.id).single(),
    // Palabra del menú del terapeuta (Inventario de Terminología, página 7)
    getTerminologiaTerapeuta(createAdminClient(), user.id),
  ])

  const terapeutaNombre = profile?.full_name ?? profile?.email ?? user.email ?? 'Terapeuta'
  const tier            = subscription?.tier ?? null

  return <ReportesPageClient tier={tier} terapeutaNombre={terapeutaNombre} terminologia={terminologia} />
}
