import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PatientsClient from './PatientsClient'

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

  const patients = (relations ?? []).map(r => {
    const profile = profiles?.find(p => p.id === r.patient_id)
    return {
      id: r.patient_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
    }
  })

  return <PatientsClient patients={patients} total={patients.length} />
}
