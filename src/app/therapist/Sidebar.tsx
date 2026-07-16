'use client'

import { useState } from 'react'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

interface SidebarProps {
  fullName: string | null
  email: string | null
  subscriptionStatus: string | null
  patientSlots: number | null
}

export default function Sidebar({ fullName, email, subscriptionStatus, patientSlots }: SidebarProps) {
  const [open, setOpen] = useState(false)

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
          onClick={() => setOpen(false)}
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
            <span className="text-2xl font-bold text-primary-700">Consúltame</span>
            <p className="text-xs text-gray-400 mt-1">{fullName ?? email}</p>
          </div>
          {/* Botón cerrar — solo en móvil */}
          <button
            onClick={() => setOpen(false)}
            className="md:hidden text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Cerrar menú"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="p-4 space-y-1" onClick={() => setOpen(false)}>
          <NavLink href="/therapist/dashboard" icon="🏠" label="Dashboard" />
          <NavLink href="/therapist/patients"  icon="👥" label="Mis pacientes" />
          <NavLink href="/therapist/codes"     icon="🔑" label="Códigos de acceso" />
        </nav>

        {/* Separador + Plan + Logout — justo bajo el nav */}
        <div className="mx-4 border-t border-gray-100" />
        <div className="p-4 space-y-3">
          <PlanBadge status={subscriptionStatus} patientSlots={patientSlots} />
          {email === 'pepe.vargas.papa@gmail.com' && (
            <NavLink href="/admin/terapeutas" icon="⚙️" label="Administración" />
          )}
          <LogoutButton />
        </div>
      </aside>
    </>
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

function PlanBadge({ status, patientSlots }: { status: string | null; patientSlots: number | null }) {
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
        🎁 Plan patrocinado{patientSlots ? ` · ${patientSlots} pac.` : ''}
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
  return (
    <Link href="/pricing" className="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-full hover:bg-amber-100 transition-colors">
      ⏳ Pendiente de aprobación →
    </Link>
  )
}
