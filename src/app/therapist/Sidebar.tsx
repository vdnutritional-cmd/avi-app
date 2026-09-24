'use client'

import { useState } from 'react'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

interface SidebarProps {
  fullName: string | null
  email: string | null
  subscriptionStatus: string | null
  patientSlots: number | null
  tier: string | null
}

export default function Sidebar({ fullName, email, subscriptionStatus, patientSlots, tier }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const closeSidebar = () => setOpen(false)
  const toggleGroup = (name: string) =>
    setOpenGroup(prev => (prev === name ? null : name))

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
            <span className="text-2xl font-bold text-primary-700">AVI - Consúltame</span>
            <p className="text-xs text-gray-400 mt-1">{fullName ?? email}</p>
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
          <NavLink href="/therapist/dashboard" icon="🏠" label="Dashboard"      onClose={closeSidebar} />
          <NavLink href="/therapist/patients"  icon="👥" label="Mis pacientes"  onClose={closeSidebar} />

          {/* Bloque: Registro de pacientes */}
          <NavGroup
            name="registro"
            label="Registro de pacientes"
            icon="📋"
            isOpen={openGroup === 'registro'}
            onToggle={() => toggleGroup('registro')}
          >
            <NavLink href="/therapist/mi-qr"                    icon="📲" label="Mi QR de registro"                    onClose={closeSidebar} />
            <NavLink href="/therapist/transferir-paciente"      icon="🔄" label="Transferir paciente a otro terapeuta" onClose={closeSidebar} />
            <NavLink href="/therapist/fusionar-paciente"        icon="⚡" label="Fusionar cuentas de un paciente"         onClose={closeSidebar} />
            <NavLink href="/therapist/codes"                    icon="🔑" label="Códigos de acceso"                    onClose={closeSidebar} />
          </NavGroup>

          {/* Bloque: Información */}
          <NavGroup
            name="informacion"
            label="Información"
            icon="📊"
            isOpen={openGroup === 'informacion'}
            onToggle={() => toggleGroup('informacion')}
          >
            <NavLink href="/therapist/asesorias"   icon="📈" label="Mis asesorías"                        onClose={closeSidebar} />
            <NavLink href="/therapist/auditoria"  icon="🔍" label="Auditorías información pacientes"      onClose={closeSidebar} />
            <NavLink href="/therapist/tutoriales" icon="🎬" label="Consejos prácticos y Tutoriales"       onClose={closeSidebar} />
            <PlanInfo status={subscriptionStatus} patientSlots={patientSlots} tier={tier} />
          </NavGroup>

          {/* Bloque: Configuración */}
          <NavGroup
            name="configuracion"
            label="Configuración"
            icon="⚙️"
            isOpen={openGroup === 'configuracion'}
            onToggle={() => toggleGroup('configuracion')}
          >
            <NavLink href="/therapist/configuracion/seguridad" icon="🔐" label="Seguridad (2FA)"          onClose={closeSidebar} />
            <NavLink href="/therapist/configuracion/terapia"  icon="🧠" label="Enfoque terapéutico"     onClose={closeSidebar} />
          </NavGroup>
        </nav>

        {/* Separador + Plan + Logout — justo bajo el nav */}
        <div className="mx-4 border-t border-gray-100" />
        <div className="p-4 space-y-3">
          <PlanBadge status={subscriptionStatus} patientSlots={patientSlots} tier={tier} />
          {email === 'pepe.vargas.papa@gmail.com' && (
            <NavLink href="/admin/terapeutas" icon="⚙️" label="Administración" onClose={closeSidebar} />
          )}
          <LogoutButton />
        </div>
      </aside>
    </>
  )
}

// ── Componentes ──────────────────────────────────────────────────────────────

function NavLink({ href, icon, label, onClose }: {
  href: string; icon: string; label: string; onClose: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-600
                 hover:bg-primary-50 hover:text-primary-700 transition-colors text-sm"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

function NavGroup({ name, label, icon, isOpen, onToggle, children }: {
  name: string; label: string; icon: string
  isOpen: boolean; onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-600
                   hover:bg-primary-50 hover:text-primary-700 transition-colors text-sm"
        aria-expanded={isOpen}
      >
        <span>{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="mt-1 ml-4 pl-3 border-l border-gray-100 space-y-1">
          {children}
        </div>
      )}
    </div>
  )
}

function PlanInfo({ status, patientSlots, tier }: { status: string | null; patientSlots: number | null; tier: string | null }) {
  const tierLabel = tier === 'clinico' ? 'Clínico' : tier === 'esencial' ? 'Esencial' : null
  const planText = tierLabel
    ? `AVI ${tierLabel}${patientSlots ? ` ${patientSlots}` : ''}`
    : null

  const statusText =
    status === 'active' || status === 'trialing' ? 'activo' :
    status === 'free_approved' ? 'patrocinado' :
    status === 'cancelled' || status === 'past_due' ? 'sin suscripción activa' :
    'pendiente de aprobación'

  const display = planText ? `${planText} · ${statusText}` : statusText

  return (
    <div className="flex items-start gap-3 px-3 py-2 text-sm text-gray-500">
      <span>📋</span>
      <div>
        <p className="text-gray-400 text-xs leading-tight mb-0.5">Características del plan:</p>
        <p className="text-gray-600">{display}</p>
      </div>
    </div>
  )
}

function PlanBadge({ status, patientSlots, tier }: { status: string | null; patientSlots: number | null; tier: string | null }) {
  const tierLabel = tier === 'clinico' ? 'Clínico' : tier === 'esencial' ? 'Esencial' : null
  const planPrefix = tierLabel
    ? `AVI ${tierLabel}${patientSlots ? ` ${patientSlots}` : ''}`
    : null

  if (status === 'active' || status === 'trialing') {
    return (
      <span className="text-xs text-green-700 bg-green-50 px-3 py-1 rounded-full leading-relaxed">
        ✓ {planPrefix ?? 'Suscripción'} · activo
      </span>
    )
  }
  if (status === 'free_approved') {
    return (
      <span className="text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
        🎁 {planPrefix ?? 'Plan'} · patrocinado
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
