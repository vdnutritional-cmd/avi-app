// ─────────────────────────────────────────────────────────────
// GET /api/patient/contacto
// Datos de contacto para la bienvenida del paciente (onboarding):
//   - Paciente con empresa CONVENIO → nombre + teléfono de la empresa
//   - Paciente sin empresa          → teléfono (WhatsApp) del terapeuta
// El WhatsApp del terapeuta vive en auth user_metadata → requiere service role.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: rel } = await admin
    .from('therapist_patients')
    .select('therapist_id, empresa_id')
    .eq('patient_id', user.id)
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle() as { data: { therapist_id: string; empresa_id: string | null } | null }

  if (!rel) return NextResponse.json({ empresaNombre: null, empresaTelefono: null, terapeutaTelefono: null })

  if (rel.empresa_id) {
    const { data: empresa } = await admin
      .from('convenio_empresas')
      .select('nombre, telefono')
      .eq('id', rel.empresa_id)
      .maybeSingle() as { data: { nombre: string; telefono: string | null } | null }

    if (empresa) {
      return NextResponse.json({
        empresaNombre:     empresa.nombre,
        empresaTelefono:   empresa.telefono ?? null,
        terapeutaTelefono: null,
      })
    }
  }

  const { data: therapist } = await admin.auth.admin.getUserById(rel.therapist_id)
  const telefono = therapist?.user?.user_metadata?.whatsapp_phone as string | undefined

  return NextResponse.json({
    empresaNombre:     null,
    empresaTelefono:   null,
    terapeutaTelefono: telefono?.trim() || null,
  })
}
