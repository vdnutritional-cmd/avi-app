import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export async function sendCrisisPush(params: {
  patientId: string
  sessionId: string
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 1. Encontrar al terapeuta de este paciente
  const { data: rel } = await supabase
    .from('therapist_patients')
    .select('therapist_id')
    .eq('patient_id', params.patientId)
    .eq('is_active', true)
    .single()

  if (!rel?.therapist_id) return

  // 2. Obtener suscripciones push del terapeuta
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('therapist_id', rel.therapist_id)

  if (!subs?.length) return

  // 3. Obtener nombre del paciente
  const { data: patient } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', params.patientId)
    .single()

  const name = patient?.full_name ?? 'Un paciente'

  const payload = JSON.stringify({
    title: `⚠️ Crisis detectada — ${name}`,
    body: `${name} puede estar en crisis. Revisa AVI ahora.`,
    patientId: params.patientId,
    url: `/therapist/patients/${params.patientId}`,
  })

  // 4. Enviar push a todos los dispositivos del terapeuta
  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 3600 } // 1 hora de vida
      )
    )
  )

  // 5. Limpiar suscripciones expiradas (410 Gone / 404 Not Found)
  const expiredEndpoints: string[] = []
  results.forEach((r, i) => {
    if (
      r.status === 'rejected' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ([410, 404].includes((r.reason as any)?.statusCode))
    ) {
      expiredEndpoints.push(subs[i].endpoint)
    }
  })

  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('therapist_id', rel.therapist_id)
      .in('endpoint', expiredEndpoints)
  }

  // 6. Marcar crisis como notificada
  await supabase
    .from('crisis_alerts')
    .update({ therapist_notified: true, notified_at: new Date().toISOString() })
    .eq('patient_id', params.patientId)
    .eq('session_id', params.sessionId)
    .eq('therapist_notified', false)
}
