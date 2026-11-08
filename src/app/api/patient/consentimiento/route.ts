import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import { getTerminologiaPaciente } from '@/lib/terminologia-paciente'
import { terminos } from '@/lib/terminologia'
import { esOpcionEscucha, CONSENTIMIENTO_VERSION, type OrigenFirma } from '@/lib/consentimiento'
import { datosDelDispositivo, empresaDeLaPersona, estadoConsentimiento, registrarFirma } from '@/lib/consentimiento-servidor'

/**
 * Consentimiento Informado v2 de la persona (8 nov 2026, src/lib/consentimiento-servidor.ts).
 *   GET  → { onboardingHecho, alDia, opcion, vigente, solicitud, terminologia, empresa, version }
 *   POST { opcion: 1|2|3, acepto: true } → firma (el texto lo arma el servidor)
 * El origen lo decide el servidor: solicitud de su <pro> → 'arco'; ya entró antes a AVI → 'reconsentimiento';
 * si no → 'primera_entrada'.
 */
const RUTA = '/api/patient/consentimiento'

async function paciente() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return perfil?.role === 'patient' ? { supabase, user } : null
}

export async function GET() {
  const auth = await paciente()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const admin = createAdminClient()
  const [estado, { data: onboarding }, terminologia, empresa] = await Promise.all([
    estadoConsentimiento(admin, auth.user.id),
    admin.from('patient_consents').select('informed_consent_at').eq('patient_id', auth.user.id).maybeSingle(),
    getTerminologiaPaciente(admin, auth.user.id),
    empresaDeLaPersona(admin, auth.user.id),
  ])
  return NextResponse.json({
    onboardingHecho: !!onboarding?.informed_consent_at,
    alDia: estado.alDia,
    opcion: estado.opcion,
    vigente: estado.vigente ? { version: estado.vigente.version, firmado_at: estado.vigente.firmado_at } : null,
    solicitud: estado.solicitud ? { id: estado.solicitud.id, created_at: estado.solicitud.created_at } : null,
    terminologia,
    empresa,
    version: CONSENTIMIENTO_VERSION,
  })
}

export async function POST(req: NextRequest) {
  const auth = await paciente()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { opcion, acepto } = await req.json().catch(() => ({}))
  if (!esOpcionEscucha(opcion)) return NextResponse.json({ error: 'Elige una opción en "Tu privacidad importa".' }, { status: 400 })
  if (acepto !== true) return NextResponse.json({ error: 'Marca la casilla para otorgar tu Consentimiento.' }, { status: 400 })

  const admin = createAdminClient()
  const [estado, { data: onboarding }, terminologia, empresa] = await Promise.all([
    estadoConsentimiento(admin, auth.user.id),
    admin.from('patient_consents').select('informed_consent_at').eq('patient_id', auth.user.id).maybeSingle(),
    getTerminologiaPaciente(admin, auth.user.id),
    empresaDeLaPersona(admin, auth.user.id),
  ])
  // Sin solicitud de su <pro>, solo se firma si falta la versión actual (la opción no se cambia por su cuenta)
  if (!estado.solicitud && estado.alDia) {
    return NextResponse.json({ error: `Ya firmaste tu Consentimiento. Para cambiar tu opción, solicítalo a tu ${terminos(terminologia).pro}.` }, { status: 409 })
  }
  const origen: OrigenFirma = estado.solicitud ? 'arco' : onboarding?.informed_consent_at ? 'reconsentimiento' : 'primera_entrada'

  const r = await registrarFirma(admin, {
    patientId: auth.user.id, opcion, origen, terminologia, empresa,
    ...datosDelDispositivo(req), solicitudId: estado.solicitud?.id ?? null,
  })
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 500 })
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'POST', { consentimiento_id: r.id, origen, opcion })
  return NextResponse.json({ ok: true })
}
