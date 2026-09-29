// ─────────────────────────────────────────────────────────────
// GET /api/cron/bloquear-inactivos
//
// Cron diario (Vercel Cron) — bloquea automáticamente pacientes
// sin actividad según la frecuencia de sesiones configurada.
//
// Límites por frecuencia_sesiones del vínculo:
//   semanal        → 15 días
//   cada_2_semanas → 30 días
//   mensual / null → 45 días
//
// El bloqueo es POR RELACIÓN terapeuta-paciente (is_active = false).
// Solo aplica a terapeutas con politica_baja = 'auto' (default).
// Al bloquear también registra abandono en patient_derivaciones_cierres
// y marca status = 'inactive' en therapist_patients.
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DIAS_POR_FRECUENCIA: Record<string, number> = {
  semanal:          15,
  cada_2_semanas:   30,
  mensual:          45,
}
const DIAS_DEFAULT = 45

function diasLimite(frecuencia: string | null | undefined): number {
  if (!frecuencia) return DIAS_DEFAULT
  return DIAS_POR_FRECUENCIA[frecuencia] ?? DIAS_DEFAULT
}

export async function GET(req: NextRequest) {
  // Protección: solo Vercel Cron o llamadas con el secret correcto
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const hoy = new Date()

  // 1. Obtener terapeutas con bloqueo automático activo
  const { data: terapeutas, error: errTerapeutas } = await admin
    .from('profiles')
    .select('id, politica_baja')
    .neq('politica_baja', 'off')

  if (errTerapeutas) {
    console.error('[cron] Error al leer perfiles:', errTerapeutas.message)
    return NextResponse.json({ error: errTerapeutas.message }, { status: 500 })
  }

  const terapeutasActivos = (terapeutas ?? []).map(t => t.id)
  if (terapeutasActivos.length === 0) {
    return NextResponse.json({ ok: true, evaluados: 0, bloqueados: 0, fecha: hoy.toISOString() })
  }

  // 2. Obtener vínculos activos solo de esos terapeutas
  const { data: vinculos, error: errorVinculos } = await admin
    .from('therapist_patients')
    .select('therapist_id, patient_id, created_at, initial_note_date, frecuencia_sesiones')
    .eq('is_active', true)
    .in('therapist_id', terapeutasActivos)

  if (errorVinculos) {
    console.error('[cron] Error al leer vínculos:', errorVinculos.message)
    return NextResponse.json({ error: errorVinculos.message }, { status: 500 })
  }

  // 3. Obtener todas las sesiones presenciales de esos terapeutas
  const { data: sesiones, error: errorSesiones } = await admin
    .from('therapist_session_notes')
    .select('therapist_id, patient_id, session_date')
    .in('therapist_id', terapeutasActivos)
    .order('session_date', { ascending: false })

  if (errorSesiones) {
    console.error('[cron] Error al leer sesiones:', errorSesiones.message)
    return NextResponse.json({ error: errorSesiones.message }, { status: 500 })
  }

  // 4. Construir mapa de última sesión por (therapist_id:patient_id)
  const ultimaSesion: Record<string, string> = {}
  for (const s of (sesiones ?? [])) {
    const key = `${s.therapist_id}:${s.patient_id}`
    if (!ultimaSesion[key]) ultimaSesion[key] = s.session_date
  }

  // 5. Evaluar cada vínculo con su propio límite de días
  const aBloquear: {
    therapist_id: string
    patient_id: string
    ultima_actividad: string
    frecuencia: string | null
    limite_dias: number
  }[] = []

  for (const v of (vinculos ?? [])) {
    const key = `${v.therapist_id}:${v.patient_id}`
    const limite = diasLimite(v.frecuencia_sesiones)
    const fechaLimite = new Date(hoy)
    fechaLimite.setDate(fechaLimite.getDate() - limite)
    const limiteFecha = fechaLimite.toISOString().split('T')[0]

    const fechas: string[] = []
    if (v.created_at)        fechas.push(v.created_at.split('T')[0])
    if (v.initial_note_date) fechas.push(v.initial_note_date)
    if (ultimaSesion[key])   fechas.push(ultimaSesion[key])

    const ultimaActividad = fechas.sort().at(-1) ?? limiteFecha

    if (ultimaActividad < limiteFecha) {
      aBloquear.push({
        therapist_id:    v.therapist_id,
        patient_id:      v.patient_id,
        ultima_actividad: ultimaActividad,
        frecuencia:      v.frecuencia_sesiones,
        limite_dias:     limite,
      })
    }
  }

  // 6. Bloquear inactivos
  let bloqueados = 0
  for (const r of aBloquear) {
    const { error: updError } = await admin
      .from('therapist_patients')
      .update({ is_active: false, status: 'inactive' })
      .eq('therapist_id', r.therapist_id)
      .eq('patient_id', r.patient_id)

    if (updError) {
      console.error(`[cron] Error bloqueando ${r.patient_id}:`, updError.message)
    } else {
      bloqueados++
      console.log(
        `[cron] Bloqueado: paciente ${r.patient_id} · terapeuta ${r.therapist_id}` +
        ` · última actividad ${r.ultima_actividad} · frecuencia ${r.frecuencia ?? 'null'} · límite ${r.limite_dias}d`
      )

      // Marcar abandono automático en patient_derivaciones_cierres
      const { error: abError } = await admin
        .from('patient_derivaciones_cierres')
        .upsert(
          {
            therapist_id: r.therapist_id,
            patient_id:   r.patient_id,
            abandono:     true,
          },
          { onConflict: 'therapist_id,patient_id' }
        )

      if (abError) {
        console.error(`[cron] Error upsert abandono ${r.patient_id}:`, abError.message)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    evaluados: vinculos?.length ?? 0,
    bloqueados,
    fecha: hoy.toISOString(),
  })
}
