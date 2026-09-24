import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import PatientsClient from './PatientsClient'

export const dynamic = 'force-dynamic'

// ── Server Action ─────────────────────────────────────────────────────────────

async function togglePaciente(formData: FormData) {
  'use server'
  const patientId  = formData.get('patientId') as string
  const nuevoEstado = formData.get('nuevoEstado') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('therapist_patients')
    .update({ is_active: nuevoEstado })
    .eq('therapist_id', user.id)
    .eq('patient_id', patientId)

  revalidatePath('/therapist/patients')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TherapistPatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Gate: el terapeuta debe haber configurado su enfoque terapéutico
  const { data: profileData } = await supabase
    .from('profiles')
    .select('therapy_profile')
    .eq('id', user!.id)
    .single()

  if (!profileData?.therapy_profile) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-5 px-4">
        <span className="text-5xl block">🧠</span>
        <h2 className="text-xl font-bold text-gray-900">Configura tu enfoque terapéutico</h2>
        <p className="text-gray-500 text-sm">
          Antes de acceder a tus pacientes, selecciona el tipo de Terapia que utilizas
          para que AVI pueda apoyarte correctamente en tus análisis clínicos.
        </p>
        <Link
          href="/therapist/configuracion/terapia"
          className="inline-block bg-primary-700 text-white text-sm font-semibold
                     px-6 py-3 rounded-xl hover:bg-primary-800 transition-colors"
        >
          Ir a configurar →
        </Link>
      </div>
    )
  }

  // Pacientes no archivados (activos e inactivos, pero no fusionados)
  const { data: relations } = await supabase
    .from('therapist_patients')
    .select('patient_id, is_active, created_at, initial_note_virtual, initial_note_pro_bono, status')
    .eq('therapist_id', user!.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  const patientIds = (relations ?? []).map(r => r.patient_id)
  const adminClient = createAdminClient()
  const { data: profiles } = patientIds.length > 0
    ? await adminClient.from('profiles').select('id, full_name, email').in('id', patientIds)
    : { data: [] }

  const patients = (relations ?? []).map(r => {
    const profile = profiles?.find(p => p.id === r.patient_id)
    return {
      id: r.patient_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      is_active: r.is_active,
      is_virtual:  r.initial_note_virtual  ?? false,
      is_pro_bono: r.initial_note_pro_bono ?? false,
    }
  })

  const activos   = patients.filter(p => p.is_active)
  const bloqueados = patients.filter(p => !p.is_active)

  if (patients.length === 0) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4 pt-12">
        <div className="text-4xl">👥</div>
        <h2 className="text-lg font-semibold text-gray-700">Presiona las 3 rayitas del menú para entrar a tu Dashboard</h2>
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
    <PatientsClient
      activos={activos}
      bloqueados={bloqueados}
      toggleAction={togglePaciente}
    />
  )
}
