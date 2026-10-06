// ─────────────────────────────────────────────────────────────
// Contacto del paciente — fuente única para la bienvenida (onboarding)
// y para la invitación de cierre del chat AVI.
//   - Paciente con empresa CONVENIO → "tu terapeuta o a <empresa> al <tel empresa>"
//   - Paciente sin empresa          → "tu terapeuta al <WhatsApp del terapeuta>"
// Solo servidor: usa service role (el WhatsApp del terapeuta vive en auth user_metadata).
// ─────────────────────────────────────────────────────────────
import { createAdminClient } from '@/lib/supabase/admin'

export interface PatientContacto {
  empresaNombre: string | null
  empresaTelefono: string | null
  terapeutaTelefono: string | null
  /** Destino ya redactado, ej. "tu terapeuta o a Valora al 33 1363 0266" */
  destino: string
}

export async function getPatientContacto(patientId: string): Promise<PatientContacto> {
  const admin = createAdminClient()
  const result: PatientContacto = {
    empresaNombre: null,
    empresaTelefono: null,
    terapeutaTelefono: null,
    destino: 'tu terapeuta',
  }

  const { data: rel } = await admin
    .from('therapist_patients')
    .select('therapist_id, empresa_id')
    .eq('patient_id', patientId)
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle() as { data: { therapist_id: string; empresa_id: string | null } | null }

  if (!rel) return result

  if (rel.empresa_id) {
    const { data: empresa } = await admin
      .from('convenio_empresas')
      .select('nombre, telefono')
      .eq('id', rel.empresa_id)
      .maybeSingle() as { data: { nombre: string; telefono: string | null } | null }

    if (empresa) {
      result.empresaNombre   = empresa.nombre
      result.empresaTelefono = empresa.telefono?.trim() || null
      result.destino = `tu terapeuta o a ${empresa.nombre}${result.empresaTelefono ? ` al ${result.empresaTelefono}` : ''}`
      return result
    }
  }

  const { data: therapist } = await admin.auth.admin.getUserById(rel.therapist_id)
  const telefono = (therapist?.user?.user_metadata?.whatsapp_phone as string | undefined)?.trim()
  if (telefono) {
    result.terapeutaTelefono = telefono
    result.destino = `tu terapeuta al ${telefono}`
  }
  return result
}
