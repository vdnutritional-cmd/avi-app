// ─────────────────────────────────────────────────────────────
// GET /api/cron/cerrar-sesiones-avi
//
// Cron diario (Vercel Cron) — cierra y analiza las sesiones AVI-Consúltame
// que quedaron abiertas porque el paciente cerró la app de golpe (ya no se
// cierran al bloquear la pantalla o cambiar de app). En el chat, los tiempos
// de espera son 10 min (escuchando) y 5 min (esperando al paciente); aquí se
// usan 15 min sin mensajes como margen para no tocar sesiones en curso.
// También se cierran al iniciar el paciente su siguiente sesión (api/chat).
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cerrarSesionesAbiertas } from '@/lib/cerrar-sesion-avi'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const r = await cerrarSesionesAbiertas(createAdminClient(), { minutosSinActividad: 15 })
  console.log('[cron] cerrar-sesiones-avi:', r)
  return NextResponse.json({ ok: true, ...r, fecha: new Date().toISOString() })
}
