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

  // 2. Obtener suscripciones de esos terapeutas (para saber si son companion o de otro tipo)
  const therapistIds = codigosExpirados
    .map(c => c.used_by as string)
    .filter(Boolean)

  const { data: subsActivas, error: errSubs } = await admin
    .from('subscriptions')
    .select('therapist_id, plan, status')
    .in('therapist_id', therapistIds)
    .eq('status', 'active')

  if (errSubs) {
    console.error('[cron/companion] Error leyendo subscriptions:', errSubs.message)
    return NextResponse.json({ error: errSubs.message }, { status: 500 })
  }

  // Indexar subscripciones por therapist_id para consulta rápida
  const subMap = new Map<string, { plan: string; status: string }>()
  for (const s of (subsActivas ?? [])) {
    subMap.set(s.therapist_id, { plan: s.plan, status: s.status })
  }

  // También procesar terapeutas sin subscription activa (bundles huérfanos)
  const todosTherapistIds = [...new Set(therapistIds)]

  if (todosTherapistIds.length === 0) {
    return NextResponse.json({ ok: true, evaluados: codigosExpirados.length, cancelados: 0, fecha: ahora })
  }

  // 3. Desactivar bundles y — solo si el plan es companion — cancelar la suscripción
  let cancelados = 0

  for (const tid of todosTherapistIds) {
    // Desactivar bundles de convenio con empresa_id=null (bundles companion)
    const { error: errBundle } = await admin
      .from('therapist_slot_bundles')
      .update({ status: 'inactive' })
      .eq('therapist_id', tid)
      .eq('source_type', 'convenio')
      .is('empresa_id', null)
      .eq('status', 'active')

    if (errBundle) {
      console.error(`[cron/companion] Error desactivando bundle de ${tid}:`, errBundle.message)
      continue
    }

    const sub = subMap.get(tid)

    if (sub?.plan === 'companion') {
      // Solo cancelar la suscripción si es específicamente un plan companion
      // (Opción B: si tiene otro plan activo, solo se desactiva el bundle)
      const { error: errSub } = await admin
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('therapist_id', tid)
        .eq('plan', 'companion')

      if (errSub) {
        console.error(`[cron/companion] Error cancelando suscripción companion de ${tid}:`, errSub.message)
        continue
      }
      console.log(`[cron/companion] ✅ Companion cancelado (sub+bundle) — terapeuta: ${tid}`)
    } else if (sub) {
      console.log(`[cron/companion] ✅ Bundle companion expirado desactivado — terapeuta: ${tid}, plan activo preservado: ${sub.plan}`)
    } else {
      console.log(`[cron/companion] ✅ Bundle companion expirado desactivado — terapeuta: ${tid} (sin sub activa)`)
    }

    cancelados++
  }

  return NextResponse.json({
    ok: true,
    evaluados: codigosExpirados.length,
    cancelados,
    fecha: ahora,
  })
}
