import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Layout de la zona del CONSULTANTE (Recupérate).
 * Verifica rol en servidor y renderiza la navegación inferior.
 */
export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'patient') redirect('/therapist/dashboard')

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="text-xl font-bold text-primary-700">Recupérate</span>
        <span className="text-sm text-gray-500">{profile?.full_name ?? user.email}</span>
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Navegación inferior */}
      <nav className="bg-white border-t border-gray-100 px-6 py-3 flex justify-around sticky bottom-0">
        <Link href="/patient/chat" className="flex flex-col items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors">
          <span className="text-xl">💬</span>
          <span>Habla</span>
        </Link>
        <Link href="/patient/discover" className="flex flex-col items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors">
          <span className="text-xl">🔍</span>
          <span>Descubre</span>
        </Link>
        <Link href="/patient/reformulate" className="flex flex-col items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors">
          <span className="text-xl">✨</span>
          <span>Reformula</span>
        </Link>
      </nav>
    </div>
  )
}
