import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTerminologiaPaciente } from '@/lib/terminologia-paciente'

/**
 * Mensajes que la persona recibió de su terapeuta (27 oct 2026). Solo lectura: no se contestan.
 *   GET   → { mensajes, noLeidos, terminologia }: sin los retirados y solo de vínculos vigentes
 *   PATCH { id } → lo marca como leído (la primera vez)
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const admin = createAdminClient()

  const [{ data: vinculos }, terminologia] = await Promise.all([
    admin.from('therapist_patients').select('therapist_id')
      .eq('patient_id', user.id).eq('is_active', true).neq('status', 'archived'),
    getTerminologiaPaciente(admin, user.id),
  ])
  const terapeutas = (vinculos ?? []).map(v => v.therapist_id as string)
  if (terapeutas.length === 0) return NextResponse.json({ mensajes: [], noLeidos: 0, terminologia })

  const { data, error } = await admin.from('patient_mensajes')
    .select('id, asunto, mensaje, created_at, leido_at')
    .eq('patient_id', user.id).in('therapist_id', terapeutas).is('retirado_at', null)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // En un traslado compartido el mensaje queda copiado en los dos terapeutas: se muestra una vez
  const vistos = new Set<string>()
  const mensajes = (data ?? []).filter(m => {
    const clave = `${m.created_at}|${m.asunto}`
    if (vistos.has(clave)) return false
    vistos.add(clave)
    return true
  })
  return NextResponse.json({ mensajes, noLeidos: mensajes.filter(m => !m.leido_at).length, terminologia })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await req.json().catch(() => ({}))
  if (typeof id !== 'string') return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const { error } = await createAdminClient().from('patient_mensajes')
    .update({ leido_at: new Date().toISOString() })
    .eq('patient_id', user.id).is('leido_at', null)
    .in('id', await copiasDe(id, user.id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** El mensaje y sus copias de un traslado compartido (mismo envío), para marcarlos leídos juntos */
async function copiasDe(id: string, patientId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data: m } = await admin.from('patient_mensajes').select('created_at, asunto')
    .eq('id', id).eq('patient_id', patientId).maybeSingle()
  if (!m) return [id]
  const { data } = await admin.from('patient_mensajes').select('id')
    .eq('patient_id', patientId).eq('created_at', m.created_at).eq('asunto', m.asunto)
  return (data ?? []).map(r => r.id as string)
}
