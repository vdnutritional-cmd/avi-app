// ─────────────────────────────────────────────────────────────
// GET /api/therapist/reporte-asesorias?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Devuelve el detalle de asesorías en un rango de fechas,
// con nombre de paciente, categorizadas en 3 bloques.
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde')
  const hasta  = searchParams.get('hasta')

  if (!desde || !hasta) {
    return NextResponse.json({ error: 'Parámetros desde y hasta requeridos' }, { status: 400 })
  }

  // Nombre del terapeuta
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Sesiones presenciales con patient_id
  const { data: sesiones } = await supabase
    .from('therapist_session_notes')
    .select('session_date, is_pro_bono, is_virtual, patient_id')
    .eq('therapist_id', user.id)
    .gte('session_date', desde)
    .lte('session_date', hasta)
    .order('session_date', { ascending: true })

  // Notas iniciales con patient_id
  const { data: notas } = await supabase
    .from('therapist_patients')
    .select('initial_note_date, initial_note_pro_bono, initial_note_virtual, patient_id')
    .eq('therapist_id', user.id)
    .not('initial_note', 'is', null)
    .not('initial_note_date', 'is', null)
    .gte('initial_note_date', desde)
    .lte('initial_note_date', hasta)

  // Recopilar todos los patient IDs únicos
  const allPatientIds = [
    ...new Set([
      ...(sesiones ?? []).map(s => s.patient_id),
      ...(notas ?? []).map(n => n.patient_id),
    ].filter(Boolean))
  ]

  // Obtener nombres de pacientes
  const { data: pacientes } = allPatientIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allPatientIds)
    : { data: [] }

  const nombrePaciente = (id: string) =>
    pacientes?.find(p => p.id === id)?.full_name ?? 'Sin nombre'

  // Construir lista combinada
  type Entry = { nombre: string; fecha: string }
  const presencialesFacturables: Entry[] = []
  const virtualesFacturables: Entry[]    = []
  const proBono: Entry[]                 = []

  const allEntries = [
    ...(sesiones ?? []).map(s => ({
      fecha:      s.session_date,
      is_pro_bono: s.is_pro_bono ?? false,
      is_virtual:  s.is_virtual  ?? false,
      nombre:      nombrePaciente(s.patient_id),
    })),
    ...(notas ?? []).map(n => ({
      fecha:      n.initial_note_date as string,
      is_pro_bono: n.initial_note_pro_bono ?? false,
      is_virtual:  (n as Record<string, unknown>).initial_note_virtual as boolean ?? false,
      nombre:      nombrePaciente(n.patient_id),
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  for (const e of allEntries) {
    if (e.is_pro_bono) {
      proBono.push({ nombre: e.nombre, fecha: e.fecha })
    } else if (e.is_virtual) {
      virtualesFacturables.push({ nombre: e.nombre, fecha: e.fecha })
    } else {
      presencialesFacturables.push({ nombre: e.nombre, fecha: e.fecha })
    }
  }

  return NextResponse.json({
    terapeutaNombre: profile?.full_name ?? '',
    desde,
    hasta,
    presencialesFacturables,
    virtualesFacturables,
    proBono,
  })
}
