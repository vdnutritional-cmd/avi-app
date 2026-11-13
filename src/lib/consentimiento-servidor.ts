// ─────────────────────────────────────────────────────────────
// Consentimiento Informado v2: firmas y solicitudes de Derechos ARCO (8 nov 2026, migración 20261108).
// Solo servidor (cliente admin). Texto en src/lib/consentimiento.ts.
//   - Cada firma es una fila nueva de patient_consentimientos (no se modifica ni se borra: trigger).
//     Guarda el texto exacto armado aquí (no el que manda el navegador), su SHA-256, la IP y el dispositivo.
//   - La opción vigente de la Escucha de AVI es la de la firma más reciente. Sin firma = no autorizada.
//   - El <pro> no cambia la opción: crea una solicitud (patient_arco_solicitudes) y la persona firma de nuevo.
// ─────────────────────────────────────────────────────────────
import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CONSENTIMIENTO_VERSION, CONSENTIMIENTO_VERSION_MINIMA, escuchaPermitida, textoFirmado,
  type OpcionEscucha, type OrigenFirma,
} from './consentimiento'
import type { Terminologia } from './terminologia'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

export interface Firma {
  id: string
  version: number
  opcion_escucha: OpcionEscucha
  origen: OrigenFirma
  firmado_at: string
  ip: string | null
  user_agent: string | null
}

export interface SolicitudArco { id: string; therapist_id: string; created_at: string }

export interface EstadoConsentimiento {
  /** Firma más reciente (cualquier versión) */
  vigente: Firma | null
  /** Firmó una versión que sigue válida (CONSENTIMIENTO_VERSION_MINIMA o más nueva) */
  alDia: boolean
  /** Opción vigente de la Escucha de AVI (null = aún no elige) */
  opcion: OpcionEscucha | null
  /** Cambio habilitado por su <pro>, pendiente de firmar */
  solicitud: SolicitudArco | null
}

const CAMPOS_FIRMA = 'id, version, opcion_escucha, origen, firmado_at, ip, user_agent'

export async function estadoConsentimiento(db: Db, patientId: string): Promise<EstadoConsentimiento> {
  const [{ data: firma }, { data: solicitud }] = await Promise.all([
    db.from('patient_consentimientos').select(CAMPOS_FIRMA)
      .eq('patient_id', patientId).order('firmado_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('patient_arco_solicitudes').select('id, therapist_id, created_at')
      .eq('patient_id', patientId).is('atendida_at', null).maybeSingle(),
  ])
  const vigente = (firma as Firma | null) ?? null
  return {
    vigente,
    alDia: (vigente?.version ?? 0) >= CONSENTIMIENTO_VERSION_MINIMA,
    opcion: vigente?.opcion_escucha ?? null,
    solicitud: (solicitud as SolicitudArco | null) ?? null,
  }
}

/** Todas las firmas de la persona, de la más reciente a la primera */
export async function historialFirmas(db: Db, patientId: string): Promise<(Firma & { texto_firmado: string; texto_sha256: string })[]> {
  const { data } = await db.from('patient_consentimientos')
    .select(`${CAMPOS_FIRMA}, texto_firmado, texto_sha256`)
    .eq('patient_id', patientId).order('firmado_at', { ascending: false })
  return (data ?? []) as (Firma & { texto_firmado: string; texto_sha256: string })[]
}

/** ¿Puede el <pro> usar la Escucha de AVI con esta persona? (también lo revisa el servidor al transcribir) */
export async function escuchaAutorizada(db: Db, patientId: string): Promise<boolean> {
  return escuchaPermitida((await estadoConsentimiento(db, patientId)).opcion)
}

/** IP y navegador de quien firma (Vercel manda la IP real en x-forwarded-for) */
export function datosDelDispositivo(req: NextRequest): { ip: string | null; user_agent: string | null } {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
  return { ip, user_agent: req.headers.get('user-agent')?.slice(0, 500) || null }
}

/**
 * Empresa en convenio que menciona el Consentimiento: la del vínculo activo más reciente
 * (la misma que usan la bienvenida y el chat, patient-contacto.ts).
 */
export async function empresaDeLaPersona(db: Db, patientId: string): Promise<string | null> {
  const { data: vinculos } = await db.from('therapist_patients')
    .select('empresa_id, is_active, created_at')
    .eq('patient_id', patientId).neq('status', 'archived')
    .order('created_at', { ascending: false })
  const rel = (vinculos ?? []).find(v => v.is_active) ?? vinculos?.[0]
  if (!rel?.empresa_id) return null
  const { data } = await db.from('convenio_empresas').select('nombre').eq('id', rel.empresa_id).maybeSingle()
  return (data?.nombre as string | undefined)?.trim() || null
}

/** Guarda una firma (y marca como atendida la solicitud de Derechos ARCO pendiente, si la hay) */
export async function registrarFirma(db: Db, d: {
  patientId: string
  opcion: OpcionEscucha
  origen: OrigenFirma
  terminologia: Terminologia
  empresa: string | null
  ip: string | null
  user_agent: string | null
  solicitudId?: string | null
}): Promise<{ id: string } | { error: string }> {
  const texto = textoFirmado({ terminologia: d.terminologia, opcion: d.opcion, empresa: d.empresa })
  const { data, error } = await db.from('patient_consentimientos').insert({
    patient_id: d.patientId,
    version: CONSENTIMIENTO_VERSION,
    opcion_escucha: d.opcion,
    origen: d.origen,
    terminologia: d.terminologia,
    empresa_nombre: d.empresa,
    texto_firmado: texto,
    texto_sha256: createHash('sha256').update(texto, 'utf8').digest('hex'),
    ip: d.ip,
    user_agent: d.user_agent,
    solicitud_id: d.solicitudId ?? null,
  }).select('id').single()
  if (error || !data) {
    console.error('[consentimiento] No se pudo guardar la firma', error?.message)
    return { error: 'No se pudo guardar tu Consentimiento. Revisa tu conexión e intenta de nuevo.' }
  }
  if (d.solicitudId) {
    const { error: e2 } = await db.from('patient_arco_solicitudes')
      .update({ atendida_at: new Date().toISOString(), consentimiento_id: data.id })
      .eq('id', d.solicitudId).is('atendida_at', null)
    if (e2) console.error('[consentimiento] No se pudo marcar la solicitud ARCO', e2.message)
  }
  return { id: data.id as string }
}
