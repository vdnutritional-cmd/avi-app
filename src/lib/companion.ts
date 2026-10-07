// ─────────────────────────────────────────────────────────────
// Activación de AVI Therapy Companion (gratis, sin Stripe) — fuente única.
// La usan el checkout (terapeuta con código) y Administración AVI
// (asignar Companion a un terapeuta existente).
//
// Opción B: si el terapeuta ya tiene otro plan activo (ej. valora), NO se
// toca su suscripción; solo se crea el bundle de pacientes independientes.
// El código queda marcado como usado por el terapeuta; si la activación
// falla, se libera para poder reintentar.
// Solo servidor (service role).
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'

/** Código CONV-XXXX-XXXX sin caracteres ambiguos (O, I, 0, 1). */
export function generarCodigoConvenio(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segment = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `CONV-${segment(4)}-${segment(4)}`
}

export type ResultadoCompanion =
  | { ok: true; tieneOtroPlanActivo: boolean; planPrevio: string | null }
  | { ok: false; error: string; status: number }

export async function activarCompanion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  { therapistId, codeId, patientSlots }: { therapistId: string; codeId: string; patientSlots: number },
): Promise<ResultadoCompanion> {
  // Marcar código como usado — solo si sigue libre (evita doble uso simultáneo)
  const { data: claimed } = await db
    .from('convenio_codes')
    .update({ used_by: therapistId, used_at: new Date().toISOString() })
    .eq('id', codeId)
    .is('used_by', null)
    .select('id')

  if (!claimed || claimed.length === 0) {
    return { ok: false, error: 'Este código ya fue utilizado.', status: 403 }
  }

  const releaseCode = async () => {
    await db
      .from('convenio_codes')
      .update({ used_by: null, used_at: null })
      .eq('id', codeId)
      .eq('used_by', therapistId)
  }

  const { data: subActual } = await db
    .from('subscriptions')
    .select('status, plan')
    .eq('therapist_id', therapistId)
    .maybeSingle() as { data: { status: string; plan: string } | null }

  const tieneOtroPlanActivo =
    !!subActual &&
    ['active', 'trialing', 'free_approved'].includes(subActual.status) &&
    subActual.plan !== 'companion'

  if (!tieneOtroPlanActivo) {
    // Sin plan previo (o solo companion): crear/actualizar suscripción companion
    const { error: subError } = await db
      .from('subscriptions')
      .upsert(
        {
          therapist_id:           therapistId,
          plan:                   'companion',
          tier:                   'clinico',   // acceso completo Esencial + Clínico
          status:                 'active',
          patient_slots:          patientSlots,
          stripe_customer_id:     null,
          stripe_subscription_id: null,
          stripe_price_id:        null,
          billing_cycle_start:    new Date().toISOString(),
        },
        { onConflict: 'therapist_id' }
      )
    if (subError) {
      console.error('[companion] Error al activar suscripción:', subError)
      await releaseCode()
      return { ok: false, error: 'Error al activar el plan.', status: 500 }
    }
  }

  // Bloque de cupo companion (empresa_id=null → cubre pacientes sin CONVENIO)
  const { error: bundleError } = await db.from('therapist_slot_bundles').insert({
    therapist_id:  therapistId,
    source_type:   'convenio',   // activado mediante código CONVENIO
    empresa_id:    null,         // null = pacientes independientes (sin empresa)
    patient_slots: patientSlots,
    discount_pct:  100,
    status:        'active',
    stripe_sub_id: null,
  })
  if (bundleError) {
    console.error('[companion] Error al crear bundle:', bundleError)
    await releaseCode()
    return { ok: false, error: 'Error al activar el plan.', status: 500 }
  }

  return { ok: true, tieneOtroPlanActivo, planPrevio: subActual?.plan ?? null }
}
