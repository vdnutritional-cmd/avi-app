// Enfoques terapéuticos que puede elegir un terapeuta (27 oct 2026). Solo servidor.
//   - Plan pagado personal activo → todos los de AVI. Cuentan los que paga con tarjeta o con código:
//     paquetes Esencial/Clínico, precio por paciente, Paquetes en CONVENIO y Companion
//     (suscripción `paid`/`unit`/`valora`/`companion` activa, o bundle activo `regular`/`convenio`).
//     El "gratis permanente" (`free_approved`) aprobado por el SaaS Controller NO cuenta.
//   - Sin plan pagado, con empresas en CONVENIO activas → la unión de lo que autorizó cada una
//     (`convenio_empresas.enfoques_permitidos`, Configuración Admin).
//   - Plan pagado vencido hace menos de DIAS_GRACIA → todos (periodo de gracia: si vuelve a pagar,
//     no pierde su configuración). `profiles.plan_pagado_visto_at` = última vez que se vio activo.
//   - Sin plan pagado y sin empresas activas → todos.
// En todos los casos elige máximo MAX_ENFOQUES. Solo el servidor (service role) cambia
// therapy_profile y plan_pagado_visto_at (trigger de la migración 20261027b).
import type { SupabaseClient } from '@supabase/supabase-js'
import { TODOS_LOS_ENFOQUES, enfoquesDePerfil, esEnfoque, perfilDeEnfoques, type EnfoqueId } from './enfoques'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

const PLANES_PAGADOS = ['paid', 'unit', 'valora', 'companion']
const ESTADOS_PAGADOS = ['active', 'trialing']
const BUNDLES_PAGADOS = ['regular', 'convenio']
export const DIAS_GRACIA = 30
const DIA_MS = 24 * 60 * 60 * 1000

export type MotivoEnfoques = 'plan_personal' | 'gracia' | 'empresas' | 'sin_empresa'

export interface EnfoquesPermitidos {
  enfoques: EnfoqueId[]
  motivo: MotivoEnfoques
  /** Empresas activas que autorizan (solo con motivo 'empresas') */
  empresas: { nombre: string; enfoques: EnfoqueId[] }[]
  /** Fin del periodo de gracia (solo con motivo 'gracia'), ISO */
  graciaHasta?: string
}

export async function getEnfoquesPermitidos(db: Db, therapistId: string): Promise<EnfoquesPermitidos> {
  const [{ data: sub }, { data: bundles }, { data: rels }, { data: perfil }] = await Promise.all([
    db.from('subscriptions').select('plan, status').eq('therapist_id', therapistId).maybeSingle(),
    db.from('therapist_slot_bundles').select('source_type').eq('therapist_id', therapistId).eq('status', 'active'),
    db.from('therapist_empresa').select('convenio_empresas(nombre, is_active, enfoques_permitidos)').eq('therapist_id', therapistId),
    db.from('profiles').select('plan_pagado_visto_at').eq('id', therapistId).maybeSingle(),
  ])
  const visto = perfil?.plan_pagado_visto_at ? new Date(perfil.plan_pagado_visto_at).getTime() : 0

  const planPersonal =
    (!!sub && PLANES_PAGADOS.includes(sub.plan) && ESTADOS_PAGADOS.includes(sub.status)) ||
    (bundles ?? []).some(b => BUNDLES_PAGADOS.includes(b.source_type))
  if (planPersonal) {
    // Fecha para el periodo de gracia; se renueva como máximo cada 12 h
    if (Date.now() - visto > DIA_MS / 2) {
      await db.from('profiles').update({ plan_pagado_visto_at: new Date().toISOString() }).eq('id', therapistId)
    }
    return { enfoques: TODOS_LOS_ENFOQUES, motivo: 'plan_personal', empresas: [] }
  }
  if (visto && Date.now() - visto < DIAS_GRACIA * DIA_MS) {
    return { enfoques: TODOS_LOS_ENFOQUES, motivo: 'gracia', empresas: [], graciaHasta: new Date(visto + DIAS_GRACIA * DIA_MS).toISOString() }
  }

  const empresas = (rels ?? []).flatMap(r => {
    const raw = r.convenio_empresas as unknown
    const e = (Array.isArray(raw) ? raw[0] : raw) as { nombre?: string; is_active?: boolean; enfoques_permitidos?: string[] } | null
    return e?.is_active
      ? [{ nombre: e.nombre ?? '', enfoques: (e.enfoques_permitidos ?? TODOS_LOS_ENFOQUES).filter(esEnfoque) }]
      : []
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  if (empresas.length === 0) return { enfoques: TODOS_LOS_ENFOQUES, motivo: 'sin_empresa', empresas: [] }

  const union = new Set(empresas.flatMap(e => e.enfoques))
  return { enfoques: TODOS_LOS_ENFOQUES.filter(id => union.has(id)), motivo: 'empresas', empresas }
}

/**
 * Quita a cada terapeuta los enfoques que ya no tiene permitidos (p. ej. su empresa los desautorizó).
 * Si no le queda ninguno, su enfoque queda vacío y el Dashboard le pide elegir otra vez.
 * Devuelve cuántos terapeutas cambiaron.
 */
export async function ajustarEnfoquesDeTerapeutas(db: Db, therapistIds: string[]): Promise<number> {
  if (therapistIds.length === 0) return 0
  const { data: perfiles, error } = await db.from('profiles').select('id, therapy_profile').in('id', therapistIds)
  if (error) throw new Error(error.message)
  let cambiados = 0
  for (const p of perfiles ?? []) {
    const actuales = enfoquesDePerfil(p.therapy_profile)
    if (actuales.length === 0) continue
    const { enfoques } = await getEnfoquesPermitidos(db, p.id)
    const quedan = actuales.filter(id => enfoques.includes(id))
    if (quedan.length === actuales.length) continue
    const { error: e } = await db.from('profiles').update({ therapy_profile: perfilDeEnfoques(quedan) }).eq('id', p.id)
    if (e) throw new Error(e.message)
    cambiados++
  }
  return cambiados
}

/**
 * Después de un alta/baja en una empresa o de activar/desactivar una empresa: los enfoques
 * permitidos pueden cambiar. No detiene la operación principal si falla (queda en el log del servidor).
 */
export async function ajustarEnfoquesTrasCambio(db: Db, opts: { therapistIds?: string[]; empresaId?: string }) {
  try {
    let ids = opts.therapistIds ?? []
    if (opts.empresaId) {
      const { data } = await db.from('therapist_empresa').select('therapist_id').eq('empresa_id', opts.empresaId)
      ids = [...ids, ...(data ?? []).map(r => r.therapist_id as string)]
    }
    await ajustarEnfoquesDeTerapeutas(db, [...new Set(ids)])
  } catch (e) {
    console.error('[enfoques] no se pudo ajustar a los terapeutas:', e)
  }
}
