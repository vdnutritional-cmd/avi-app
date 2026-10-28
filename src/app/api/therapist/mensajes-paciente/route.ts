import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import { MAX_ASUNTO, MAX_MENSAJE, motivoSinMensajes, avisarMensajeNuevo } from '@/lib/mensajes-paciente'

/**
 * Mensajes del terapeuta a una persona (AVI-CLÍNICO › Cuestionarios, 27 oct 2026).
 *   GET   ?patientId=…                 → { mensajes } (también los retirados, para el registro)
 *   POST  { patientId, asunto, mensaje } → envía y avisa por correo (sin el contenido)
 *   PATCH { id }                        → retira un mensaje enviado por error (no se borra)
 */
const RUTA = '/api/therapist/mensajes-paciente'

async function usuario() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(req: NextRequest) {
  const { supabase, user } = await usuario()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const patientId = req.nextUrl.searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'Falta patientId' }, { status: 400 })

  const motivo = await motivoSinMensajes(user.id, patientId)
  if (motivo === 'No autorizado') return NextResponse.json({ error: motivo }, { status: 403 })

  const { data, error } = await createAdminClient().from('patient_mensajes')
    .select('id, asunto, mensaje, created_at, leido_at, retirado_at')
    .eq('therapist_id', user.id).eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logApiAccess(supabase, user.id, RUTA, 'GET', { patient_id: patientId })
  return NextResponse.json({ mensajes: data ?? [], puedeEnviar: motivo === null, motivo })
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await usuario()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const patientId = typeof body.patientId === 'string' ? body.patientId : ''
  const asunto = typeof body.asunto === 'string' ? body.asunto.trim() : ''
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : ''
  if (!patientId) return NextResponse.json({ error: 'Falta patientId' }, { status: 400 })
  if (!asunto || !mensaje) return NextResponse.json({ error: 'Escribe el asunto y el mensaje.' }, { status: 400 })
  if (asunto.length > MAX_ASUNTO) return NextResponse.json({ error: `El asunto admite hasta ${MAX_ASUNTO} caracteres.` }, { status: 400 })
  if (mensaje.length > MAX_MENSAJE) return NextResponse.json({ error: `El mensaje admite hasta ${MAX_MENSAJE} caracteres.` }, { status: 400 })

  const motivo = await motivoSinMensajes(user.id, patientId)
  if (motivo) return NextResponse.json({ error: motivo }, { status: 403 })

  const { data, error } = await createAdminClient().from('patient_mensajes')
    .insert({ patient_id: patientId, therapist_id: user.id, asunto, mensaje })
    .select('id').single()
  if (error) return NextResponse.json({ error: 'No se pudo enviar. Intenta de nuevo.' }, { status: 500 })

  avisarMensajeNuevo(user.id, patientId)
  logApiAccess(supabase, user.id, RUTA, 'POST', { patient_id: patientId, mensaje_id: data.id })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await usuario()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await req.json().catch(() => ({}))
  if (typeof id !== 'string') return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const { data, error } = await createAdminClient().from('patient_mensajes')
    .update({ retirado_at: new Date().toISOString() })
    .eq('id', id).eq('therapist_id', user.id).is('retirado_at', null)
    .select('patient_id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'El mensaje no existe o ya fue retirado.' }, { status: 404 })

  logApiAccess(supabase, user.id, RUTA, 'PATCH', { patient_id: data.patient_id, mensaje_id: id, accion: 'retirar' })
  return NextResponse.json({ ok: true })
}
