import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'pepe.vargas.papa@gmail.com'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        {/* Fila superior: logo + email */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Link href="https://go.avi-app.com.mx/therapist/patients" className="text-xl font-bold text-primary-700">AVI</Link>
            <span className="text-sm text-gray-400 hidden sm:inline">|</span>
            <span className="text-sm font-medium text-gray-600 hidden sm:inline">Panel de Administración</span>
          </div>
          <span className="text-xs text-gray-400 truncate max-w-[140px]">{user.email}</span>
        </div>
        {/* Menú horizontal con scroll en móvil */}
        <nav className="flex items-center gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-0.5">
          <Link href="/admin/terapeutas" className="text-sm text-gray-600 hover:text-purple-700 transition-colors whitespace-nowrap">
            Terapeutas
          </Link>
          <Link href="/admin/convenio" className="text-sm text-gray-600 hover:text-purple-700 transition-colors whitespace-nowrap">
            Códigos CONVENIO
          </Link>
          <Link href="/admin/convenio-empresas" className="text-sm text-gray-600 hover:text-purple-700 transition-colors whitespace-nowrap">
            Empresas en CONVENIO
          </Link>
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  )
}
