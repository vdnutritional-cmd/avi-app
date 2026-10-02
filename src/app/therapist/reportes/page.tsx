import { createClient } from '@/lib/supabase/server'
import ReportesPageClient from './ReportesPageClient'

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
    supabase.from('subscriptions').select('tier').eq('therapist_id', user.id).single(),
  ])

  const terapeutaNombre = profile?.full_name ?? profile?.email ?? user.email ?? 'Terapeuta'
  const tier            = subscription?.tier ?? null

  return <ReportesPageClient tier={tier} terapeutaNombre={terapeutaNombre} />
}
