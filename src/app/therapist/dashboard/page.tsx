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
    { data: therapistProfile },
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
    supabase
      .from('profiles')
      .select('therapy_profile')
      .eq('id', user!.id)
      .single(),
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

  const PERFIL_LABELS: Record<string, string> = {
    famsis:      'Personalismo + Familiar Sistémica',
    trec:        'Personalismo + TREC',
    cc:          'Personalismo + Cognitivo-Conductual',
    famsis_trec: 'Personalismo + Familiar Sistémica + TREC',
    famsis_cc:   'Personalismo + Familiar Sistémica + Cognitivo-Conductual',
    trec_cc:     'Personalismo + TREC + Cognitivo-Conductual',
  }

  const perfil = therapistProfile?.therapy_profile
  const perfilConfigurado = perfil && perfil !== 'famsis'

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Bienvenido a AVI - Consúltame — tu centro de gestión terapéutica</p>
      </div>

      {/* Enfoque terapéutico — pendiente de configurar */}
      {!perfilConfigurado && (
        <Link
          href="/therapist/configuracion/terapia"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50
                     p-4 hover:bg-amber-100 transition-colors group"
        >
          <span className="text-2xl">🧠</span>
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm group-hover:text-amber-900 transition-colors">
              Configura tu enfoque terapéutico
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Selecciona el tipo de Terapia que utilizas y deseas que utilice AVI
              para apoyarte en tus análisis clínicos. Toca aquí para configurar →
            </p>
          </div>
        </Link>
      )}

      {/* Enfoque terapéutico — ya configurado */}
      {perfilConfigurado && (
        <Link
          href="/therapist/configuracion/terapia"
          className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50
                     p-4 hover:bg-green-100 transition-colors group"
        >
          <span className="text-2xl">✅</span>
          <div className="flex-1">
            <p className="font-semibold text-green-800 text-sm group-hover:text-green-900 transition-colors">
              Configuración de terapia seleccionada para la realización de los análisis clínicos:
            </p>
            <p className="text-xs text-green-700 mt-0.5 font-medium">
              {PERFIL_LABELS[perfil!] ?? perfil}
            </p>
          </div>
        </Link>
      )}

      {/* Contadores */}
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

      {/* Acciones rápidas */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Acciones rápidas</h2>
        <div className="grid grid-cols-1 gap-3">

          {/* Ver mis pacientes */}
          <ActionCard
            href="/therapist/patients"
            icon="👥"
            title="Ver mis pacientes"
            description="Revisa los resúmenes y patrones emocionales de tus consultantes"
          />

          {/* Auditorías */}
          <ActionCard
            href="/therapist/auditoria"
            icon="🔍"
            title="Auditorías información pacientes"
            description="Consulta el historial de cambios clínicos de tus pacientes (NOM-024)"
          />

          {/* Asesorías este mes */}
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

          {/* Consejos prácticos y Tutoriales */}
          <Link
            href="/therapist/tutoriales"
            className="flex items-center justify-between bg-white rounded-2xl border border-gray-100
                       p-5 hover:border-primary-200 hover:bg-primary-50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🎬</span>
              <div>
                <p className="font-semibold text-gray-800 group-hover:text-primary-700 transition-colors">
                  Consejos prácticos y Tutoriales
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Videos de capacitación para sacar el máximo provecho de AVI
                </p>
              </div>
            </div>
            <span className="text-gray-300 group-hover:text-primary-400 transition-colors text-sm">Ver →</span>
          </Link>

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
