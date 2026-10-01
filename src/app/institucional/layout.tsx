import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function InstitucionalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  // Solo terapeutas registrados como personas institucionales pueden entrar aquí
  if (profile?.role !== 'therapist') redirect('/patient/chat')

  const admin = createAdminClient()

  const { data: pi } = await admin
    .from('convenio_personas_institucionales')
    .select('nivel, opera_como_terapeuta, empresa_id, convenio_empresas(nombre)')
    .eq('therapist_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Si no tiene registro institucional activo, redirigir al panel normal
  if (!pi) redirect('/therapist/dashboard')

  const empresaNombre = (pi.convenio_empresas as { nombre?: string } | null)?.nombre ?? 'Empresa'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Encabezado institucional */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-primary-700">AVI</span>
          <span className="text-gray-300">·</span>
          <span className="text-sm text-gray-700 font-semibold">{empresaNombre}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            pi.nivel === 'N1' ? 'bg-green-100 text-green-700' :
            pi.nivel === 'N2' ? 'bg-blue-100 text-blue-700' :
            'bg-amber-100 text-amber-700'
          }`}>
            {pi.nivel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 hidden sm:inline">{profile?.full_name}</span>
          {pi.opera_como_terapeuta && (
            <Link
              href="/therapist/dashboard"
              className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
            >
              Panel terapeuta →
            </Link>
          )}
          <Link
            href="/api/auth/logout"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Salir
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
