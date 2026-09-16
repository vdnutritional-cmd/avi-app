import { createClient } from '@supabase/supabase-js'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

/**
 * Envía una notificación push via Expo Push API al terapeuta del paciente.
 * Se usa como complemento del web push VAPID (ya existente) para llegar
 * a la app nativa cuando el terapeuta tiene la app cerrada.
 */
export async function sendExpoCrisisPush(params: {
  patientId: string
  sessionId: string
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 1. Encontrar al terapeuta del paciente
  const { data: rel } = await supabase
    .from('therapist_patients')
    .select('therapist_id')
    .eq('patient_id', params.patientId)
    .eq('is_active', true)
    .single()

  if (!rel?.therapist_id) return

  // 2. Obtener expo_push_token del terapeuta
  const { data: profile } = await supabase
    .from('profiles')
    .select('expo_push_token, full_name')
    .eq('id', rel.therapist_id)
    .single()

  const token = profile?.expo_push_token
  if (!token || !token.startsWith('ExponentPushToken[')) return

  // 3. Obtener nombre del paciente
  const { data: patient } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', params.patientId)
    .single()

  const name = patient?.full_name ?? 'Un paciente'

  // 4. Enviar push via Expo Push API
  const message = {
    to: token,
    channelId: 'crisis',
    sound: 'default',
    title: `⚠️ Crisis detectada — ${name}`,
    body: `${name} puede estar en crisis. Abre AVI para revisar.`,
    data: {
      patientId: params.patientId,
      sessionId: params.sessionId,
      url: `https://go.avi-app.com.mx/therapist/patients/${params.patientId}`,
    },
    priority: 'high',
    badge: 1,
  }

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(message),
  })

  if (!res.ok) {
    console.error('[expo-push] Error HTTP:', res.status, await res.text())
    return
  }

  const result = await res.json()
  const ticket = result.data

  if (ticket?.status === 'error') {
    console.error('[expo-push] Error del ticket:', ticket.message, ticket.details)

    // Si el token expiró/fue desregistrado, limpiarlo de la BD
    if (ticket.details?.error === 'DeviceNotRegistered') {
      await supabase
        .from('profiles')
        .update({ expo_push_token: null })
        .eq('id', rel.therapist_id)
      console.log('[expo-push] Token limpiado (DeviceNotRegistered)')
    }
    return
  }

  console.log('[expo-push] ✅ Push enviado al terapeuta:', rel.therapist_id)
}
