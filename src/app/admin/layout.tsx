import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from './AdminSidebar'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'pepe.vargas.papa@gmail.com'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) redirect('/auth/login')

  return (
    <div className="min-h-screen flex bg-gray-50">
      <AdminSidebar email={user.email ?? ''} />

      {/* Contenido principal — padding-top extra en móvil para el botón hamburger */}
      <main className="flex-1 px-6 py-10 pt-16 md:pt-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
