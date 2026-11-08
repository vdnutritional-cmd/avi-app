import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { escuchaAutorizada } from '@/lib/consentimiento-servidor'

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

/**
 * Escucha de AVI (8 nov 2026): solo si la persona la autorizó en su Consentimiento (opción 2 o 3).
 * null = autorizada; si no, la respuesta de error para el <pro>.
 */
export async function rechazoSinEscucha(patientId: string | null) {
  if (!patientId) return NextResponse.json({ error: 'Falta la persona.' }, { status: 400 })
  if (await escuchaAutorizada(createAdminClient(), patientId)) return null
  return NextResponse.json({ error: 'Esta persona no autorizó la Escucha de AVI en su Consentimiento Informado.' }, { status: 403 })
}
