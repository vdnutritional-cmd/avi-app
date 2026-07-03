import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from './LogoutButton'
import PushRegistrar from './PushRegistrar'

export default async function TherapistLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'therapist') redirect('/patient/chat')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, plan, patient_slots')
    .eq('therapist_id', user.id)
    .single()

  const hasAccess = subscription?.status
    ? ['active', 'free_approved', 'trialing'].includes(subscription.status)
    : true

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col min-h-screen sticky top-0">
        <div className="p-6 border-b border-gray-100">
          <span className="text-2xl font-bold text-primary-700">Consúltame</span>
          <p className="text-xs text-gray-400 mt-1">{profile?.full_name ?? user.email}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLink href="/therapist/dashboard" icon="🏠" label="Dashboard" />
          <NavLink href="/therapist/patients" icon="👥" label="Mis pacientes" />
          <NavLink href="/therapist/codes" icon="🔑" label="Códigos de acceso" />
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <PlanBadge status={subscription?.status ?? null} />
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>

      <PushRegistrar />
    </div>
  )
}

function PlanBadge({ status }: { status: string | null }) {
  if (status === 'active' || status === 'trialing') {
    return (
      <span className="text-xs text-green-700 bg-green-50 px-3 py-1 rounded-full">
        ✓ Suscripción activa
      </span>
    )
  }
  if (status === 'free_approved') {
    return (
      <span className="text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
        🎁 Plan patrocinado
      </span>
    )
  }
  if (status === 'cancelled' || status === 'past_due') {
    return (
      <Link href="/pricing" className="text-xs text-red-600 bg-red-50 px-3 py-1 rounded-full hover:bg-red-100 transition-colors">
        ⚠️ Sin suscripción activa →
      </Link>
    )
  }
  // Sin registro en subscriptions = acceso beta
  return (
    <span className="text-xs text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
      VALORA — acceso gratuito
    </span>
  )
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-600
                 hover:bg-primary-50 hover:text-primary-700 transition-colors text-sm"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
