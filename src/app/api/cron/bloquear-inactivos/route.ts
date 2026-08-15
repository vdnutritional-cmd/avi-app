// ─────────────────────────────────────────────────────────────
// GET /api/cron/bloquear-inactivos
//
// Cron diario (Vercel Cron) — bloquea automáticamente pacientes
// sin actividad en los últimos 45 días para cada terapeuta.
//
// "Actividad" se define como el MAX de:
//   • initial_note_date  (la Nota Inicial cuenta como sesión)
//   • MAX(session_date)  de therapist_session_notes
//   • created_at         del vínculo terapeuta-paciente (fallback)
//
// El bloqueo es POR RELACIÓN terapeuta-paciente (is_active = false).
// El terapeuta puede reactivar manualmente en cualquier momento.
// Al registrar una nueva Sesión Presencial, el contador se reinicia.
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DIAS_INACTIVIDAD = 45

export async function GET(req: NextRequest) {
  // Protección: solo Vercel Cron o llamadas con el secret correcto
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const hoy = new Date()
  const limite = new Date(hoy)
  limite.setDate(limite.getDate() - DIAS_INACTIVIDAD)
  const limiteFecha = limite.toISOString().split('T')[0] // YYYY-MM-DD

  // 1. Obtener todos los vínculos activos con su última actividad
  const { data: vinculos, error } = await admin
    .from('therapist_patients')
    .select(`
      therapist_id,
      patient_id,
      created_at,
      initial_note_date,
      therapist_session_notes (
        session_date
      )
    `)
    .eq('is_active', true)

  if (error) {
    console.error('[cron/bloquear-inactivos] Error al leer vínculos:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const aBloquear: { therapist_id: string; patient_id: string; ultima_actividad: string }[] = []

  for (const v of (vinculos ?? [])) {
    // Calcular última actividad
    const fechas: string[] = []

    // Fecha de registro del vínculo (fallback)
    if (v.created_at) fechas.push(v.created_at.split('T')[0])

    // Nota inicial (cuenta como sesión)
    if (v.initial_note_date) fechas.push(v.initial_note_date)

    // Sesiones presenciales
    const sesiones = (v.therapist_session_notes as { session_date: string }[] | null) ?? []
    for (const s of sesiones) {
      if (s.session_date) fechas.push(s.session_date)
    }

    // Última actividad = la fecha más reciente
    const ultimaActividad = fechas.sort().at(-1) ?? limiteFecha

    if (ultimaActividad < limiteFecha) {
      aBloquear.push({
        therapist_id: v.therapist_id,
        patient_id: v.patient_id,
        ultima_actividad: ultimaActividad,
      })
    }
  }

  // 2. Bloquear los inactivos
  let bloqueados = 0
  for (const r of aBloquear) {
    const { error: updError } = await admin
      .from('therapist_patients')
      .update({ is_active: false })
      .eq('therapist_id', r.therapist_id)
      .eq('patient_id', r.patient_id)

    if (updError) {
      console.error(`[cron] Error bloqueando ${r.patient_id}:`, updError.message)
    } else {
      bloqueados++
      console.log(`[cron] Bloqueado: paciente ${r.patient_id} · terapeuta ${r.therapist_id} · última actividad ${r.ultima_actividad}`)
    }
  }

  return NextResponse.json({
    ok: true,
    evaluados: vinculos?.length ?? 0,
    bloqueados,
    fecha: hoy.toISOString(),
  })
}
