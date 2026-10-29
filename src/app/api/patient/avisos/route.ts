import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { contarPendientesPaciente } from '@/lib/push/avisar-paciente'

/**
 * Avisos del paciente (28 oct 2026).
 *   GET  → { pendientes }: mensajes sin leer + cuestionarios por contestar (número del ícono de AVI)
 *   POST { endpoint, keys } → guarda este teléfono para los avisos push
 */
async function paciente() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return perfil?.role === 'patient' ? user.id : null
}

export async function GET() {
  const patientId = await paciente()
  if (!patientId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json({ pendientes: await contarPendientesPaciente(createAdminClient(), patientId) })
}

export async function POST(req: NextRequest) {
  const patientId = await paciente()
  if (!patientId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { endpoint, keys } = await req.json().catch(() => ({}))
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
  }
  const admin = createAdminClient()
  // Un teléfono es de una sola persona: si antes entró otra cuenta en él, deja de recibir sus avisos
  await admin.from('patient_push_subscriptions').delete().eq('endpoint', endpoint).neq('patient_id', patientId)
  const { error } = await admin.from('patient_push_subscriptions').upsert(
    { patient_id: patientId, endpoint, p256dh: keys.p256dh, auth: keys.auth, updated_at: new Date().toISOString() },
    { onConflict: 'patient_id,endpoint' },
  )
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
