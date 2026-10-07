import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import PushRegistrar from './PushRegistrar'
import Sidebar from './Sidebar'
import ReportesPanel from './ReportesPanel'
import WhatsAppSupport from '@/components/WhatsAppSupport'
import ActivarPlan from './ActivarPlan'
import InactivityGuard from '@/components/InactivityGuard'

// Statuses que permiten acceso al app
const ACTIVE_STATUSES = ['active', 'trialing', 'free_approved']

export default async function TherapistLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'therapist') redirect('/patient/chat')

  // ── Bloqueo institucional ────────────────────────────────────────────────────
  // Si el terapeuta es persona institucional con opera_como_terapeuta=false,
  // redirigir a su panel institucional (el panel de terapeuta está desactivado).
  const admin = createAdminClient()
  // Fetch todos los registros institucionales activos del terapeuta.
  // Un terapeuta puede pertenecer a más de una empresa; .maybeSingle() falla en ese caso.
  const { data: piRecords } = await admin
    .from('convenio_personas_institucionales')
    .select('opera_como_terapeuta')
    .eq('therapist_id', user.id)
    .eq('is_active', true)

  const hasPI = (piRecords?.length ?? 0) > 0
  // Bloquear acceso al panel de terapeuta solo si TODOS los registros tienen opera=false
  const canActAsTherapist = piRecords?.some(r => r.opera_como_terapeuta) ?? true

  if (hasPI && !canActAsTherapist) {
    redirect('/institucional/dashboard')
  }

  // ── Empresas del terapeuta (para acordeón "Mis pacientes" en Sidebar) ────────
  // Todos los terapeutas vinculados a una empresa pueden gestionar asignaciones,
  // independientemente de si son Persona Institucional.
  const { data: empresaRels } = await admin
    .from('therapist_empresa')
    .select('empresa_id, convenio_empresas(is_active)')
    .eq('therapist_id', user.id)

  const hasEmpresas = (empresaRels?.length ?? 0) > 0
  // Regla "la empresa paga": con al menos una empresa CONVENIO activa entra aunque no tenga plan propio
  const hasEmpresaActiva = (empresaRels ?? []).some(r => {
    const e = r.convenio_empresas as { is_active?: boolean } | { is_active?: boolean }[] | null
    return (Array.isArray(e) ? e[0] : e)?.is_active === true
  })

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, plan, patient_slots, tier')
    .eq('therapist_id', user.id)
    .single()

  // ── Gate: sin plan activo NI empresa CONVENIO activa → pantalla de activación ──
  const hasPlan = !!subscription && ACTIVE_STATUSES.includes(subscription.status)
  if (!hasPlan && !hasEmpresaActiva) {
    return <ActivarPlan therapistName={profile?.full_name ?? ''} />
  }

  return (
    <InactivityGuard>
      <div className="min-h-screen flex bg-gray-50">
        <Sidebar
          fullName={profile?.full_name ?? null}
          email={profile?.email ?? user.email ?? null}
          subscriptionStatus={subscription?.status ?? null}
          patientSlots={subscription?.patient_slots ?? null}
          tier={subscription?.tier ?? null}
          isInstitucional={hasPI}
          hasEmpresas={hasEmpresas}
          accesoConvenio={!hasPlan && hasEmpresaActiva}
        />

        {/* Contenido principal — padding-top extra en móvil para el botón hamburger */}
        <main className="flex-1 p-8 pt-16 md:pt-8 overflow-y-auto">
          {children}
        </main>

        <PushRegistrar />
        <WhatsAppSupport />
        <ReportesPanel
          tier={subscription?.tier ?? null}
          terapeutaNombre={profile?.full_name ?? profile?.email ?? user.email ?? 'Terapeuta'}
        />
      </div>
    </InactivityGuard>
  )
}
