// Mensajes del terapeuta al paciente (27 oct 2026). Solo servidor.
// Canal de un solo sentido (Asunto + Mensaje), solo AVI-CLÍNICO; el paciente los lee en "Mensajes".
// Al enviar se le avisa por correo SIN el contenido (no se manda información clínica por correo).
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccesoTerapeuta, accesoDePaciente } from '@/lib/acceso-paciente'
import { getTerminologiaPersona } from '@/lib/terminologia-paciente'
import { terminos } from '@/lib/terminologia'
import { resend, EMAIL_FROM } from '@/lib/email'

export const MAX_ASUNTO = 150
export const MAX_MENSAJE = 5000

/**
 * ¿Puede este terapeuta mandar mensajes a esta persona? Vínculo vigente y nivel AVI-CLÍNICO.
 * Devuelve null si sí, o el motivo si no.
 */
export async function motivoSinMensajes(therapistId: string, patientId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data: tp } = await admin.from('therapist_patients')
    .select('empresa_id, is_active, status')
    .eq('therapist_id', therapistId).eq('patient_id', patientId)
    .neq('status', 'archived')
    .limit(1).maybeSingle()
  if (!tp) return 'No autorizado'
  if (!tp.is_active) return 'La persona está bloqueada; reactívala para enviarle mensajes.'
  const acceso = await getAccesoTerapeuta(admin, therapistId)
  const { tier, bloqueado } = accesoDePaciente(acceso, patientId, tp.empresa_id as string | null)
  if (bloqueado) return 'La persona no tiene acceso con tu plan actual.'
  if (tier !== 'clinico') return 'Los mensajes son parte de AVI-CLÍNICO.'
  return null
}

/** Correo al paciente: solo avisa que hay un mensaje, sin asunto ni contenido. */
export function avisarMensajeNuevo(therapistId: string, patientId: string) {
  const avisar = async () => {
    if (!process.env.RESEND_API_KEY) return
    const admin = createAdminClient()
    const [{ data: u }, { data: perfil }, terminologia] = await Promise.all([
      admin.auth.admin.getUserById(patientId),
      admin.from('profiles').select('full_name').eq('id', patientId).maybeSingle(),
      getTerminologiaPersona(admin, therapistId, patientId),
    ])
    const para = u?.user?.email
    if (!para) return
    const { pro } = terminos(terminologia)
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://avi-app.com.mx'}/patient/mensajes`
    const nombre = (perfil?.full_name as string | undefined)?.split(' ')[0]
    await resend.emails.send({
      from: EMAIL_FROM,
      to: para,
      subject: `Tienes un mensaje nuevo de tu ${pro} en AVI`,
      text: [
        nombre ? `Hola, ${nombre}:` : 'Hola:',
        '',
        `Tienes un mensaje nuevo de tu ${pro} en AVI. Entra a tu cuenta para leerlo, en la pestaña "Mensajes":`,
        url,
        '',
        'Por tu privacidad, el contenido del mensaje solo se puede ver dentro de AVI.',
      ].join('\n'),
    }).catch(e => console.error('[mensajes-paciente] correo', e))
  }
  try {
    after(avisar)
  } catch {
    void avisar()
  }
}
