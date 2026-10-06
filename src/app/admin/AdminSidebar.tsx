'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

interface AdminSidebarProps {
  email: string
}

export default function AdminSidebar({ email }: AdminSidebarProps) {
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const closeSidebar = () => setOpen(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* ignorar */ }
    router.push('/')
  }

  return (
    <>
      {/* Botón hamburger — solo visible en móvil */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 bg-white border border-gray-200
                   rounded-xl p-2.5 shadow-sm hover:bg-gray-50 transition-colors"
        aria-label="Abrir menú"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay oscuro en móvil */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 h-screen z-50
          w-64 bg-white border-r border-gray-100 flex flex-col
          transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <Link
              href="/therapist/dashboard"
              className="text-2xl font-bold text-primary-700 hover:text-primary-800 transition-colors"
              onClick={closeSidebar}
            >
              AVI
            </Link>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Panel de Administración</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{email}</p>
          </div>
          {/* Botón cerrar — solo en móvil */}
          <button
            onClick={closeSidebar}
            className="md:hidden text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Cerrar menú"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="p-4 space-y-1 overflow-y-auto flex-1">
          <NavLink href="/admin"                  icon="🏠" label="Panel de Control"        active={pathname === '/admin'}                          onClose={closeSidebar} />
          <NavLink href="/admin/terapeutas"       icon="👩‍⚕️" label="Terapeutas"              active={pathname.startsWith('/admin/terapeutas')}        onClose={closeSidebar} />
          <NavLink href="/admin/convenio"         icon="🔑" label="Códigos CONVENIO"         active={pathname.startsWith('/admin/convenio') && !pathname.startsWith('/admin/convenio-empresas')} onClose={closeSidebar} />
          <NavLink href="/admin/convenio-empresas" icon="🏢" label="Empresas en CONVENIO"   active={pathname.startsWith('/admin/convenio-empresas')} onClose={closeSidebar} />
          <NavLink href="/admin/reportes"         icon="📊" label="Reportes"                 active={pathname.startsWith('/admin/reportes')}          onClose={closeSidebar} />
          <NavLink href="/admin/auditoria"        icon="🔍" label="Auditoría"                active={pathname.startsWith('/admin/auditoria')}         onClose={closeSidebar} />
        </nav>

        {/* Footer */}
        <div className="mx-4 border-t border-gray-100" />
        <div className="p-4 space-y-3">
          <Link
            href="/therapist/dashboard"
            onClick={closeSidebar}
            className="flex items-center gap-2 text-xs text-primary-600 hover:text-primary-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver a AVI
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-500
                       hover:bg-red-50 hover:text-red-600 transition-colors text-sm disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
    </>
  )
}

function NavLink({ href, icon, label, active, onClose }: {
  href: string; icon: string; label: string; active: boolean; onClose: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-sm ${
        active
          ? 'bg-primary-50 text-primary-700 font-medium'
          : 'text-gray-600 hover:bg-primary-50 hover:text-primary-700'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
