// ─────────────────────────────────────────────────────────────
// Contacto del paciente — fuente única para la bienvenida (onboarding)
// y para la invitación de cierre del chat AVI.
//   - Paciente con empresa CONVENIO → "tu <pro> o a <empresa> al <tel empresa>"
//   - Paciente sin empresa          → "tu <pro> al <WhatsApp del terapeuta>"
// <pro> = terapeuta / asesor según la terminología de la empresa (src/lib/terminologia.ts).
// Solo servidor: usa service role (el WhatsApp del terapeuta vive en auth user_metadata).
// ─────────────────────────────────────────────────────────────
import { createAdminClient } from '@/lib/supabase/admin'
import { terminos, TERMINOLOGIA_SIN_EMPRESA, type Terminologia } from '@/lib/terminologia'
import { terminologiaDeVinculo } from '@/lib/terminologia-paciente'

export interface PatientContacto {
  empresaNombre: string | null
  empresaTelefono: string | null
  terapeutaTelefono: string | null
  /** Palabras que ve el paciente (de su empresa; sin empresa → "Cómo me nombran" de su terapeuta) */
  terminologia: Terminologia
  /** Destino ya redactado, ej. "tu terapeuta o a Valora al 33 1363 0266" */
  destino: string
}

export async function getPatientContacto(patientId: string): Promise<PatientContacto> {
  const admin = createAdminClient()
  const result: PatientContacto = {
    empresaNombre: null,
    empresaTelefono: null,
    terapeutaTelefono: null,
    terminologia: TERMINOLOGIA_SIN_EMPRESA,
    destino: `tu ${terminos(TERMINOLOGIA_SIN_EMPRESA).pro}`,
  }

  // Vínculo activo más reciente (un paciente puede tener otro vínculo bloqueado o inactivo)
  const { data: vinculos } = await admin
    .from('therapist_patients')
    .select('therapist_id, empresa_id, is_active, created_at')
    .eq('patient_id', patientId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false }) as { data: { therapist_id: string; empresa_id: string | null; is_active: boolean }[] | null }
  const rel = (vinculos ?? []).find(v => v.is_active) ?? vinculos?.[0] ?? null

  if (!rel) return result
  result.terminologia = await terminologiaDeVinculo(admin, rel)
  result.destino = `tu ${terminos(result.terminologia).pro}`

  if (rel.empresa_id) {
    const { data: empresa } = await admin
      .from('convenio_empresas')
      .select('nombre, telefono')
      .eq('id', rel.empresa_id)
      .maybeSingle() as { data: { nombre: string; telefono: string | null } | null }

    if (empresa) {
      result.empresaNombre   = empresa.nombre
      result.empresaTelefono = empresa.telefono?.trim() || null
      result.destino = `tu ${terminos(result.terminologia).pro} o a ${empresa.nombre}${result.empresaTelefono ? ` al ${result.empresaTelefono}` : ''}`
      return result
    }
  }

  const { data: therapist } = await admin.auth.admin.getUserById(rel.therapist_id)
  const telefono = (therapist?.user?.user_metadata?.whatsapp_phone as string | undefined)?.trim()
  if (telefono) {
    result.terapeutaTelefono = telefono
    result.destino = `tu ${terminos(result.terminologia).pro} al ${telefono}`
  }
  return result
}
