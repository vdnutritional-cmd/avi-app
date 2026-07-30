import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { patientId, fullName } = await req.json()
    if (!patientId || !fullName?.trim()) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Verificar que este paciente pertenece al terapeuta que hace la solicitud
    const { data: relation } = await supabase
      .from('therapist_patients')
      .select('patient_id')
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .single()

    if (!relation) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 403 })
    }

    // Actualizar nombre con cliente admin (bypasa RLS de profiles)
    const admin = createAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', patientId)

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar nombre: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Error interno: ' + msg }, { status: 500 })
  }
}
