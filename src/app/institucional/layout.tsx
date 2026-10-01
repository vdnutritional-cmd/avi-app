import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstitucionalLogoutButton from './LogoutButton'

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

  // Fetch todos los registros activos — un terapeuta puede pertenecer a varias empresas.
  // .maybeSingle() falla (devuelve null) cuando hay más de una fila, por eso usamos array.
  const { data: piRecords } = await admin
    .from('convenio_personas_institucionales')
    .select('nivel, opera_como_terapeuta, empresa_id, convenio_empresas(nombre)')
    .eq('therapist_id', user.id)
    .eq('is_active', true)

  // Si no tiene ningún registro institucional activo, redirigir al panel normal
  if (!piRecords || piRecords.length === 0) redirect('/therapist/dashboard')

  // Nivel más alto (N1 > N2 > N3) entre todas las empresas del usuario
  const NIVEL_ORDER: Record<string, number> = { N1: 1, N2: 2, N3: 3 }
  const sorted = [...piRecords].sort(
    (a, b) => NIVEL_ORDER[a.nivel] - NIVEL_ORDER[b.nivel]
  )
  const topNivel = sorted[0].nivel
  const canActAsTherapist = piRecords.some(r => r.opera_como_terapeuta)
  const empresaNombres = piRecords
    .map(r => (r.convenio_empresas as { nombre?: string } | null)?.nombre ?? 'Empresa')
    .join(', ')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Encabezado institucional */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-primary-700">AVI</span>
          <span className="text-gray-300">·</span>
          <span className="text-sm text-gray-700 font-semibold">{empresaNombres}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            topNivel === 'N1' ? 'bg-green-100 text-green-700' :
            topNivel === 'N2' ? 'bg-blue-100 text-blue-700' :
            'bg-amber-100 text-amber-700'
          }`}>
            {topNivel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 hidden sm:inline">{profile?.full_name}</span>
          {canActAsTherapist && (
            <Link
              href="/therapist/dashboard"
              className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
            >
              Panel terapeuta
            </Link>
          )}
          <InstitucionalLogoutButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
