// ─────────────────────────────────────────────────────────────
// GET /api/cron/desactivar-companion-expirados
//
// Cron diario (Vercel Cron) — cancela automáticamente las
// suscripciones de tipo 'companion' cuyo código CONVENIO ha expirado.
//
// Lógica:
//   JOIN subscriptions (plan='companion', status='active')
//     con convenio_codes (used_by = therapist_id)
//   WHERE convenio_codes.expires_at < NOW()
//   → status = 'cancelled' en subscriptions
//   → status = 'inactive'  en therapist_slot_bundles (mismo terapeuta, source_type='convenio')
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  // Protección: solo Vercel Cron o llamadas con el secret correcto
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const ahora = new Date().toISOString()

  // 1. Buscar códigos CONVENIO expirados que activaron un companion
  //    (used_by != null → el código fue usado por un terapeuta)
  const { data: codigosExpirados, error: errCodigos } = await admin
    .from('convenio_codes')
    .select('used_by, expires_at')
    .not('used_by', 'is', null)
    .not('expires_at', 'is', null)
    .lt('expires_at', ahora)

  if (errCodigos) {
    console.error('[cron/companion] Error leyendo convenio_codes:', errCodigos.message)
    return NextResponse.json({ error: errCodigos.message }, { status: 500 })
  }

  if (!codigosExpirados || codigosExpirados.length === 0) {
    return NextResponse.json({ ok: true, evaluados: 0, cancelados: 0, fecha: ahora })
  }

  // 2. Filtrar los que tienen suscripción companion activa
  const therapistIds = codigosExpirados
    .map(c => c.used_by as string)
    .filter(Boolean)

  const { data: subsActivas, error: errSubs } = await admin
    .from('subscriptions')
    .select('therapist_id')
    .in('therapist_id', therapistIds)
    .eq('plan', 'companion')
    .eq('status', 'active')

  if (errSubs) {
    console.error('[cron/companion] Error leyendo subscriptions:', errSubs.message)
    return NextResponse.json({ error: errSubs.message }, { status: 500 })
  }

  const aExpirar = subsActivas ?? []

  if (aExpirar.length === 0) {
    return NextResponse.json({ ok: true, evaluados: codigosExpirados.length, cancelados: 0, fecha: ahora })
  }

  // 3. Cancelar suscripciones y bundles
  let cancelados = 0

  for (const sub of aExpirar) {
    const tid = sub.therapist_id

    // Cancelar suscripción principal
    const { error: errSub } = await admin
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('therapist_id', tid)
      .eq('plan', 'companion')

    if (errSub) {
      console.error(`[cron/companion] Error cancelando suscripción de ${tid}:`, errSub.message)
      continue
    }

    // Desactivar bundles de convenio del mismo terapeuta
    const { error: errBundle } = await admin
      .from('therapist_slot_bundles')
      .update({ status: 'inactive' })
      .eq('therapist_id', tid)
      .eq('source_type', 'convenio')
      .eq('status', 'active')

    if (errBundle) {
      console.error(`[cron/companion] Error desactivando bundle de ${tid}:`, errBundle.message)
    }

    cancelados++
    console.log(`[cron/companion] ✅ Companion expirado cancelado — terapeuta: ${tid}`)
  }

  return NextResponse.json({
    ok: true,
    evaluados: codigosExpirados.length,
    cancelados,
    fecha: ahora,
  })
}
