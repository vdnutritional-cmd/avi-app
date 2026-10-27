import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Terapeuta con sesión y, si viene patientId, que la persona sea suya. null = no autorizado. */
export async function autorizarTerapeuta(patientId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (patientId) {
    const { data } = await createAdminClient()
      .from('therapist_patients')
      .select('id')
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .neq('status', 'archived')
      .limit(1)
      .maybeSingle()
    if (!data) return null
  }
  return { supabase, user }
}
