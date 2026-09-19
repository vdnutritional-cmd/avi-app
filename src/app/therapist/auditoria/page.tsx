import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AuditoriaTherapistClient from './AuditoriaTherapistClient'

export const dynamic = 'force-dynamic'

const TABLAS_CLINICAS = [
  'patient_expediente',
  'therapist_session_notes',
  'analyses',
  'patient_questionnaires',
]

export default async function TherapistAuditoriaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // 1. Obtener los patient_ids del terapeuta (activos e inactivos — auditoría incluye todo)
  const { data: relations } = await admin
    .from('therapist_patients')
    .select('patient_id')
    .eq('therapist_id', user.id)

  const patientIds = (relations ?? []).map(r => r.patient_id as string)

  if (patientIds.length === 0) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4 pt-12">
        <div className="text-4xl">🔍</div>
        <h2 className="text-lg font-semibold text-gray-700">Sin registros de auditoría</h2>
        <p className="text-sm text-gray-400">
          Aún no tienes pacientes vinculados o no hay registros clínicos en el sistema de auditoría.
        </p>
      </div>
    )
  }

  // 2. Obtener nombres de los pacientes
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', patientIds)

  const pacientes: Record<string, string> = {}
  for (const p of profiles ?? []) {
    pacientes[p.id] = p.full_name ?? p.email ?? p.id
  }

  // 3. Consultar audit_log filtrando por patient_id en datos_despues o datos_antes
  //    Solo tablas clínicas relevantes para el terapeuta
  const orFilter = patientIds
    .map(id => `datos_despues->>patient_id.eq.${id},datos_antes->>patient_id.eq.${id}`)
    .join(',')

  const { data: logs } = await admin
    .from('audit_log')
    .select('id, usuario_id, operacion, tabla, registro_id, datos_antes, datos_despues, created_at')
    .in('tabla', TABLAS_CLINICAS)
    .or(orFilter)
    .order('created_at', { ascending: false })
    .limit(300)

  return (
    <AuditoriaTherapistClient
      logs={logs ?? []}
      pacientes={pacientes}
    />
  )
}
