// Avisos push al paciente (28 oct 2026): mensaje nuevo o cuestionario de su terapeuta. Solo servidor.
// La notificación no lleva el contenido (igual que el correo). Lleva el número de pendientes para
// el número del ícono de AVI (iPhone 16.4+ con AVI en la pantalla de inicio; en Android depende del teléfono).
// Las suscripciones se quedan al cerrar sesión: el paciente sale solo a los 30 min y así le siguen llegando.
import webpush from 'web-push'
import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTerminologiaPersona } from '@/lib/terminologia-paciente'
import { terminos } from '@/lib/terminologia'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

/** Mensajes sin leer (de vínculos vigentes, sin retirados ni copias de un traslado) + cuestionarios por contestar */
export async function contarPendientesPaciente(db: Db, patientId: string): Promise<number> {
  const [{ data: vinculos }, { count: cuestionarios }] = await Promise.all([
    db.from('therapist_patients').select('therapist_id')
      .eq('patient_id', patientId).eq('is_active', true).neq('status', 'archived'),
    db.from('patient_questionnaires').select('id', { count: 'exact', head: true })
      .eq('patient_id', patientId).eq('status', 'pending'),
  ])
  const terapeutas = (vinculos ?? []).map(v => v.therapist_id as string)
  let mensajes = 0
  if (terapeutas.length > 0) {
    const { data } = await db.from('patient_mensajes').select('created_at, asunto')
      .eq('patient_id', patientId).in('therapist_id', terapeutas)
      .is('retirado_at', null).is('leido_at', null)
    mensajes = new Set((data ?? []).map(m => `${m.created_at}|${m.asunto}`)).size
  }
  return mensajes + (cuestionarios ?? 0)
}

/** Manda el aviso a todos los teléfonos del paciente, después de responder (no retrasa al terapeuta) */
export function avisarPacientePush(therapistId: string, patientId: string, tipo: 'mensaje' | 'cuestionario') {
  const avisar = async () => {
    const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privada = process.env.VAPID_PRIVATE_KEY
    if (!publica || !privada || !process.env.VAPID_SUBJECT) return
    const admin = createAdminClient()
    const { data: subs } = await admin.from('patient_push_subscriptions')
      .select('endpoint, p256dh, auth').eq('patient_id', patientId)
    if (!subs?.length) return

    const [terminologia, badge] = await Promise.all([
      getTerminologiaPersona(admin, therapistId, patientId),
      contarPendientesPaciente(admin, patientId),
    ])
    const { pro } = terminos(terminologia)
    const payload = JSON.stringify({
      tipo: 'paciente',
      title: 'AVI',
      body: tipo === 'mensaje'
        ? `Tienes un mensaje nuevo de tu ${pro}.`
        : `Tu ${pro} te envió un cuestionario para contestar.`,
      url: '/patient/chat',
      badge,
    })

    webpush.setVapidDetails(process.env.VAPID_SUBJECT, publica, privada)
    const resultados = await Promise.allSettled(subs.map(s =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 7 * 24 * 3600 })
    ))
    // Teléfonos que ya no aceptan avisos (410 Gone / 404): se quitan
    const vencidos = subs.filter((_, i) => {
      const r = resultados[i]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return r.status === 'rejected' && [404, 410].includes((r.reason as any)?.statusCode)
    }).map(s => s.endpoint)
    if (vencidos.length) {
      await admin.from('patient_push_subscriptions').delete().eq('patient_id', patientId).in('endpoint', vencidos)
    }
  }
  const conRegistro = () => avisar().catch(e => console.error('[avisar-paciente] push', e))
  try {
    after(conRegistro)
  } catch {
    void conRegistro()
  }
}
