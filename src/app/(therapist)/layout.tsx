import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Layout de la zona del TERAPEUTA (Consultame).
 * Verifica rol y suscripción activa.
 */
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

  // Verificar suscripción activa (se activa completamente en Sprint 5)
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('therapist_id', user.id)
    .single()

  const hasAccess = subscription?.status
    ? ['active', 'free_approved', 'trialing'].includes(subscription.status)
    : false

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
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

        {/* Status suscripción */}
        <div className="p-4 border-t border-gray-100">
          {hasAccess ? (
            <span className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full">
              ✓ Suscripción activa
            </span>
          ) : (
            <Link
              href="/therapist/subscribe"
              className="text-xs text-primary-600 bg-primary-50 px-3 py-1 rounded-full hover:bg-primary-100 transition"
            >
              Activar suscripción →
            </Link>
          )}
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 p-8 overflow-y-auto">
        {hasAccess ? children : <NoAccessBanner />}
      </main>
    </div>
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

function NoAccessBanner() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 max-w-sm mx-auto">
      <div className="text-5xl">🔒</div>
      <h2 className="text-xl font-bold text-gray-800">Activa tu suscripción</h2>
      <p className="text-gray-500 text-sm">
        Para acceder a Consultame y gestionar tus pacientes, necesitas una suscripción activa.
      </p>
      <Link
        href="/therapist/subscribe"
        className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition"
      >
        Ver planes — desde $12 USD/mes
      </Link>
    </div>
  )
}
