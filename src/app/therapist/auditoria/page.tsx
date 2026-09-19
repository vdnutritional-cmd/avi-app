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

  // 1. Patient IDs del terapeuta (activos + inactivos — la auditoría cubre todo)
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

  // 2. Nombres de los pacientes
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', patientIds)

  const pacientes: Record<string, string> = {}
  for (const p of profiles ?? []) {
    pacientes[p.id] = p.full_name ?? p.email ?? p.id
  }

  // 3. Traer todos los registros de tablas clínicas (sin filtro JSONB en DB)
  //    y filtrar en JavaScript servidor — más seguro y sin problemas de sintaxis PostgREST
  const patientIdSet = new Set(patientIds)

  const { data: rawLogs } = await admin
    .from('audit_log')
    .select('id, usuario_id, operacion, tabla, registro_id, datos_antes, datos_despues, created_at')
    .in('tabla', TABLAS_CLINICAS)
    .order('created_at', { ascending: false })
    .limit(2000)   // traemos más y filtramos abajo

  // Filtrar: solo registros donde patient_id pertenece a este terapeuta
  const logs = (rawLogs ?? []).filter(l => {
    const pid =
      (l.datos_despues as Record<string, unknown> | null)?.patient_id as string | undefined
      ?? (l.datos_antes  as Record<string, unknown> | null)?.patient_id as string | undefined
    return pid !== undefined && patientIdSet.has(pid)
  })

  return (
    <AuditoriaTherapistClient
      logs={logs}
      pacientes={pacientes}
    />
  )
}
