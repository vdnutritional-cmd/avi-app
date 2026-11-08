import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import { autorizarTerapeuta } from '@/app/api/transcribir-sesion/autorizar'
import { CONSENTIMIENTO_VERSION, dispositivoDe } from '@/lib/consentimiento'
import { estadoConsentimiento, historialFirmas } from '@/lib/consentimiento-servidor'
import { avisarPacientePush } from '@/lib/push/avisar-paciente'

/**
 * Consentimiento Informado v2 de una persona, visto por su <pro> (8 nov 2026).
 *   GET  ?patientId= → { opcion, alDia, version, firmas[], solicitud }   (Escucha de AVI y Derechos ARCO)
 *   POST { patientId } → habilita el cambio (Derechos ARCO): la persona elige y firma de nuevo en su app.
 * El <pro> nunca elige ni cambia la opción de la persona.
 */
const RUTA = '/api/therapist/consentimiento'

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'Falta la persona' }, { status: 400 })
  const auth = await autorizarTerapeuta(patientId)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const [estado, firmas] = await Promise.all([estadoConsentimiento(admin, patientId), historialFirmas(admin, patientId)])
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'GET', { patientId })
  return NextResponse.json({
    opcion: estado.opcion,
    alDia: estado.alDia,
    version: CONSENTIMIENTO_VERSION,
    firmas: firmas.map(f => ({
      id: f.id, version: f.version, opcion: f.opcion_escucha, origen: f.origen, firmado_at: f.firmado_at,
      ip: f.ip, dispositivo: dispositivoDe(f.user_agent), sha256: f.texto_sha256,
    })),
    solicitud: estado.solicitud ? { created_at: estado.solicitud.created_at, propia: estado.solicitud.therapist_id === auth.user.id } : null,
  })
}

export async function POST(req: NextRequest) {
  const { patientId } = await req.json().catch(() => ({}))
  if (typeof patientId !== 'string' || !patientId) return NextResponse.json({ error: 'Falta la persona' }, { status: 400 })
  const auth = await autorizarTerapeuta(patientId)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('patient_arco_solicitudes')
    .insert({ patient_id: patientId, therapist_id: auth.user.id }).select('id, created_at').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya hay un cambio habilitado, pendiente de firmar.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'POST', { patientId, solicitud_id: data.id })
  avisarPacientePush(auth.user.id, patientId, 'arco')
  return NextResponse.json({ ok: true, solicitud: { created_at: data.created_at, propia: true } })
}
