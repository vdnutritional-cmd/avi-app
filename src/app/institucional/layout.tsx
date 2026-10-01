import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '@/app/therapist/Sidebar'
import InactivityGuard from '@/components/InactivityGuard'
import WhatsAppSupport from '@/components/WhatsAppSupport'

export default async function InstitucionalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
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

  const canActAsTherapist = piRecords.some(r => r.opera_como_terapeuta)

  // Empresas del terapeuta en therapist_empresa (para prop hasEmpresas del Sidebar)
  const { data: empresaRels } = await admin
    .from('therapist_empresa')
    .select('empresa_id')
    .eq('therapist_id', user.id)
    .limit(1)
  const hasEmpresas = (empresaRels?.length ?? 0) > 0

  // Suscripción (para PlanBadge en Sidebar)
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, plan, patient_slots, tier')
    .eq('therapist_id', user.id)
    .single()

  return (
    <InactivityGuard>
      <div className="min-h-screen flex bg-gray-50">
        <Sidebar
          fullName={profile?.full_name ?? null}
          email={profile?.email ?? user.email ?? null}
          subscriptionStatus={subscription?.status ?? null}
          patientSlots={subscription?.patient_slots ?? null}
          tier={subscription?.tier ?? null}
          isInstitucional={true}
          hasEmpresas={hasEmpresas}
          disabled={!canActAsTherapist}
          hideInstitucionalLink={false}
        />

        {/* Contenido principal — padding-top extra en móvil para el botón hamburger */}
        <main className="flex-1 p-8 pt-16 md:pt-8 overflow-y-auto">
          {children}
        </main>

        <WhatsAppSupport />
      </div>
    </InactivityGuard>
  )
}
