import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function TherapistDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { count: patientCount },
    { count: codeCount },
    { data: subscription },
  ] = await Promise.all([
    supabase
      .from('therapist_patients')
      .select('*', { count: 'exact', head: true })
      .eq('therapist_id', user!.id)
      .eq('is_active', true),
    supabase
      .from('authorization_codes')
      .select('*', { count: 'exact', head: true })
      .eq('therapist_id', user!.id)
      .eq('is_active', true)
      .is('used_by', null),
    supabase
      .from('subscriptions')
      .select('status, plan, patient_slots')
      .eq('therapist_id', user!.id)
      .single(),
  ])

  const hasAccess = subscription?.status
    ? ['active', 'free_approved', 'trialing'].includes(subscription.status)
    : false

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Bienvenido a Consúltame — tu centro de gestión terapéutica</p>
      </div>

      {/* Banner: sin suscripción → dirigir a elegir plan */}
      {!hasAccess && !subscription && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-800">Activa tu plan para comenzar</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Elige el plan que mejor se adapte a ti. Si eres Asesor VALORA o
              calificas para acceso patrocinado, contáctanos por WhatsApp al{' '}
              <strong>33 1883 0312</strong>.
            </p>
          </div>
          <Link
            href="/pricing"
            className="shrink-0 bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-amber-700 transition-colors"
          >
            Ver planes →
          </Link>
        </div>
      )}

      {/* Banner: suscripción cancelada o vencida */}
      {!hasAccess && subscription && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-700">Tu suscripción no está activa</p>
            <p className="text-sm text-red-500 mt-0.5">Activa un plan para seguir usando Consúltame.</p>
          </div>
          <Link
            href="/pricing"
            className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-red-700 transition-colors"
          >
            Ver planes →
          </Link>
        </div>
      )}

      {/* Card plan patrocinado */}
      {subscription?.status === 'free_approved' && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center gap-4">
          <span className="text-3xl">🎁</span>
          <div>
            <p className="font-semibold text-blue-800">Plan patrocinado activo</p>
            <p className="text-sm text-blue-600 mt-0.5">
              Tu acceso a Consúltame está siendo patrocinado. No se te cobrará nada.
              {subscription.patient_slots
                ? ` Capacidad: hasta ${subscription.patient_slots} pacientes.`
                : ''}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-3xl font-bold text-primary-600">{patientCount ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">Pacientes activos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-3xl font-bold text-calm-500">{codeCount ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">Códigos disponibles</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Acciones rápidas</h2>
        <div className="grid grid-cols-1 gap-3">
          <ActionCard
            href="/therapist/codes"
            icon="🔑"
            title="Generar código de acceso"
            description="Crea un código para que tu paciente se registre en Recupérate"
          />
          <ActionCard
            href="/therapist/patients"
            icon="👥"
            title="Ver mis pacientes"
            description="Revisa los resúmenes y patrones emocionales de tus consultantes"
          />
        </div>
      </div>

    </div>
  )
}

function ActionCard({ href, icon, title, description }: {
  href: string; icon: string; title: string; description: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100
                 p-5 hover:border-primary-200 hover:bg-primary-50 transition-colors group"
    >
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="font-semibold text-gray-800 group-hover:text-primary-700 transition-colors">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <span className="ml-auto text-gray-300 group-hover:text-primary-400 transition-colors">→</span>
    </Link>
  )
}
