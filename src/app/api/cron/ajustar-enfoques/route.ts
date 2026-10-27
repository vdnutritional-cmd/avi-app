// ─────────────────────────────────────────────────────────────
// Cron diario 10:30 UTC (después de desactivar-companion-expirados):
// a cada terapeuta con enfoque se le quitan los que ya no tiene permitidos
// (p. ej. terminó su periodo de gracia de 30 días tras vencer su plan pagado).
// También renueva plan_pagado_visto_at de quien tiene plan pagado activo.
// Regla: src/lib/enfoques-permitidos.ts
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ajustarEnfoquesDeTerapeutas } from '@/lib/enfoques-permitidos'

export async function GET(req: NextRequest) {
  // Protección: solo Vercel Cron o llamadas con el secret correcto
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('profiles').select('id').eq('role', 'therapist').not('therapy_profile', 'is', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    const ajustados = await ajustarEnfoquesDeTerapeutas(admin, (data ?? []).map(p => p.id as string))
    console.log(`[cron/ajustar-enfoques] ✅ Revisados: ${data?.length ?? 0}, ajustados: ${ajustados}`)
    return NextResponse.json({ ok: true, revisados: data?.length ?? 0, ajustados })
  } catch (e) {
    console.error('[cron/ajustar-enfoques] Error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
