import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TherapistPatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: relations } = await supabase
    .from('therapist_patients')
    .select('patient_id, created_at')
    .eq('therapist_id', user!.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  // Obtener perfiles de cada paciente
  const patientIds = (relations ?? []).map(r => r.patient_id)
  const { data: profiles } = patientIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, email').in('id', patientIds)
    : { data: [] }

  if (!relations || relations.length === 0) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4 pt-12">
        <div className="text-4xl">👥</div>
        <h2 className="text-lg font-semibold text-gray-700">Sin pacientes aún</h2>
        <p className="text-sm text-gray-400">
          Genera un código en la sección de Códigos y compártelo con tu paciente para que se registre.
        </p>
        <Link href="/therapist/codes" className="inline-block text-sm text-primary-600 hover:underline">
          Ir a Códigos →
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <div className="pt-2 pb-1">
        <h1 className="text-xl font-semibold text-gray-800">Mis pacientes</h1>
        <p className="text-sm text-gray-400">{relations.length} paciente{relations.length !== 1 ? 's' : ''} activo{relations.length !== 1 ? 's' : ''}</p>
      </div>

      {relations.map((r) => {
        const profile = profiles?.find(p => p.id === r.patient_id) ?? null
        return (
          <Link
            key={r.patient_id}
            href={`/therapist/patients/${r.patient_id}`}
            className="block bg-white rounded-2xl border border-gray-100 px-5 py-4
                       hover:border-primary-200 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">{profile?.full_name ?? 'Sin nombre'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{profile?.email}</p>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
