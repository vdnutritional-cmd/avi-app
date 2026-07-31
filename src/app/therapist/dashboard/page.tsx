import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function TherapistDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const mesInicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const mesFin    = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]

  const [
    { count: patientCount },
    { count: codeCount },
    { data: subscription },
    { data: sesionesDelMes },
    { data: notasIniciales },
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
    supabase
      .from('therapist_session_notes')
      .select('is_pro_bono')
      .eq('therapist_id', user!.id)
      .gte('session_date', mesInicio)
      .lt('session_date', mesFin),
    supabase
      .from('therapist_patients')
      .select('initial_note_pro_bono')
      .eq('therapist_id', user!.id)
      .not('initial_note', 'is', null)
      .not('initial_note_date', 'is', null)
      .gte('initial_note_date', mesInicio)
      .lt('initial_note_date', mesFin),
  ])

  // Combinar sesiones presenciales + notas iniciales (igual que asesorias/page.tsx)
  const todasAsesorias = [
    ...(sesionesDelMes ?? []),
    ...(notasIniciales ?? []).map(n => ({ is_pro_bono: n.initial_note_pro_bono ?? false })),
  ]
  const totalAsesorias   = todasAsesorias.length
  const totalFacturables = todasAsesorias.filter(s => !s.is_pro_bono).length

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
          <p className="text-sm text-gray-500 mt-1">Códigos entregados a pacientes sin usar</p>
        </div>
      </div>

      {/* Resumen asesorías del mes */}
      <Link
        href="/therapist/asesorias"
        className="flex items-center justify-between bg-white rounded-2xl border border-gray-100
                   p-5 hover:border-primary-200 hover:bg-primary-50 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <span className="text-3xl">📊</span>
          <div>
            <p className="font-semibold text-gray-800 group-hover:text-primary-700 transition-colors">
              Asesorías este mes
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalAsesorias === 0
                ? 'Sin sesiones registradas aún'
                : `${totalAsesorias} totales · ${totalFacturables} facturables · ${totalAsesorias - totalFacturables} pro-bono`}
            </p>
          </div>
        </div>
        <span className="text-gray-300 group-hover:text-primary-400 transition-colors text-sm">Ver detalle →</span>
      </Link>

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
