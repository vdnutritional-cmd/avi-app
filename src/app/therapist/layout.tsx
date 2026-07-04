import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PushRegistrar from './PushRegistrar'
import Sidebar from './Sidebar'
import WhatsAppSupport from '@/components/WhatsAppSupport'

export default async function TherapistLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'therapist') redirect('/patient/chat')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, plan, patient_slots')
    .eq('therapist_id', user.id)
    .single()

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar
        fullName={profile?.full_name ?? null}
        email={profile?.email ?? user.email ?? null}
        subscriptionStatus={subscription?.status ?? null}
        patientSlots={subscription?.patient_slots ?? null}
      />

      {/* Contenido principal — padding-top extra en móvil para el botón hamburger */}
      <main className="flex-1 p-8 pt-16 md:pt-8 overflow-y-auto">
        {children}
      </main>

      <PushRegistrar />
      <WhatsAppSupport />
    </div>
  )
}
