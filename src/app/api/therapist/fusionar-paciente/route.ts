// ─────────────────────────────────────────────────────────────
// /api/therapist/fusionar-paciente
//
// GET  ?emailOrigen=xxx&emailDestino=yyy
//      → Vista previa: qué tiene cada cuenta
//
// POST { emailOrigen, emailDestino }
//      → Ejecuta la fusión con fusionarCuentas() (src/lib/fusionar-cuentas.ts):
//        toda la información pasa a la real (campo por campo, respetando la real),
//        sesiones presenciales juntas y numeradas por fecha; la temporal se archiva
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fusionarCuentas } from '@/lib/fusionar-cuentas'

// ── Helpers ───────────────────────────────────────────────────

async function resolvePatientId(adminClient: ReturnType<typeof createAdminClient>, email: string) {
  const { data } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .eq('role', 'patient')
    .maybeSingle()
  return data?.id ?? null
}

// ── GET — vista previa ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const emailOrigen  = req.nextUrl.searchParams.get('emailOrigen')?.trim()
  const emailDestino = req.nextUrl.searchParams.get('emailDestino')?.trim()
  if (!emailOrigen || !emailDestino) {
    return NextResponse.json({ error: 'emailOrigen y emailDestino requeridos' }, { status: 400 })
  }
  if (emailOrigen.toLowerCase() === emailDestino.toLowerCase()) {
    return NextResponse.json({ error: 'Los correos deben ser diferentes' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const [origenId, destinoId] = await Promise.all([
    resolvePatientId(adminClient, emailOrigen),
    resolvePatientId(adminClient, emailDestino),
  ])

  if (!origenId)  return NextResponse.json({ error: `No se encontró ningún paciente con el correo: ${emailOrigen}` }, { status: 404 })
  if (!destinoId) return NextResponse.json({ error: `No se encontró ningún paciente con el correo: ${emailDestino}` }, { status: 404 })

  // Verificar que ambos pertenecen a este terapeuta
  const [{ data: tpOrigen }, { data: tpDestino }] = await Promise.all([
    supabase.from('therapist_patients')
      .select('patient_id, initial_note, initial_note_date, status')
      .eq('therapist_id', user.id)
      .eq('patient_id', origenId)
      .maybeSingle(),
    supabase.from('therapist_patients')
      .select('patient_id, initial_note, initial_note_date, status')
      .eq('therapist_id', user.id)
      .eq('patient_id', destinoId)
      .maybeSingle(),
  ])

  if (!tpOrigen)  return NextResponse.json({ error: `La cuenta ${emailOrigen} no pertenece a tu lista de pacientes` }, { status: 404 })
  if (!tpDestino) return NextResponse.json({ error: `La cuenta ${emailDestino} no pertenece a tu lista de pacientes` }, { status: 404 })
  if (tpOrigen.status === 'archived') return NextResponse.json({ error: 'La cuenta de origen ya está archivada' }, { status: 400 })

  // Qué tiene cada cuenta
  const resumen = async (patientId: string) => {
    const contar = (tabla: string) => supabase.from(tabla)
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', user.id).eq('patient_id', patientId)
    const [{ count: sesiones }, { count: expediente }] = await Promise.all([
      contar('therapist_session_notes'), contar('patient_expediente'),
    ])
    return { sesiones: sesiones ?? 0, tieneExpediente: (expediente ?? 0) > 0 }
  }
  const [rO, rD] = await Promise.all([resumen(origenId), resumen(destinoId)])

  const preview = {
    origen:  { email: emailOrigen,  id: origenId,  tieneNotaInicial: !!tpOrigen.initial_note,  fechaNota: tpOrigen.initial_note_date,  ...rO },
    destino: { email: emailDestino, id: destinoId, tieneNotaInicial: !!tpDestino.initial_note, fechaNota: tpDestino.initial_note_date, ...rD },
    sesionesPresenciales: rO.sesiones,
    advertencias: [] as string[],
  }

  if (!tpOrigen.initial_note && rO.sesiones === 0 && !rO.tieneExpediente) {
    preview.advertencias.push('La cuenta temporal no tiene nota inicial, datos generales ni sesiones presenciales.')
  }
  if (rO.sesiones > 0 && rD.sesiones > 0) {
    preview.advertencias.push(`Las ${rO.sesiones + rD.sesiones} sesiones presenciales de ambas cuentas se ordenarán por fecha y se numerarán de nuevo (la más antigua será la Sesión 1).`)
  }

  return NextResponse.json({ preview })
}

// ── POST — ejecutar fusión ────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { emailOrigen, emailDestino } = await req.json()
  if (!emailOrigen || !emailDestino) {
    return NextResponse.json({ error: 'emailOrigen y emailDestino requeridos' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const [origenId, destinoId] = await Promise.all([
    resolvePatientId(adminClient, emailOrigen),
    resolvePatientId(adminClient, emailDestino),
  ])

  if (!origenId || !destinoId) {
    return NextResponse.json({ error: 'No se encontraron los pacientes indicados' }, { status: 404 })
  }
  if (origenId === destinoId) {
    return NextResponse.json({ error: 'Las cuentas deben ser diferentes' }, { status: 400 })
  }

  // Obtener registros completos
  const [{ data: tpOrigen }, { data: tpDestino }] = await Promise.all([
    supabase.from('therapist_patients')
      .select('*')
      .eq('therapist_id', user.id)
      .eq('patient_id', origenId)
      .maybeSingle(),
    supabase.from('therapist_patients')
      .select('*')
      .eq('therapist_id', user.id)
      .eq('patient_id', destinoId)
      .maybeSingle(),
  ])

  if (!tpOrigen)  return NextResponse.json({ error: 'Cuenta de origen no encontrada en tu lista' }, { status: 404 })
  if (!tpDestino) return NextResponse.json({ error: 'Cuenta destino no encontrada en tu lista' }, { status: 404 })
  if (tpOrigen.status === 'archived') return NextResponse.json({ error: 'La cuenta de origen ya está archivada' }, { status: 400 })

  try {
    const resultado = await fusionarCuentas(adminClient, user.id, origenId, destinoId)
    return NextResponse.json({ ok: true, resultado, mensaje: 'Fusión completada. La cuenta temporal quedó archivada.' })
  } catch (e) {
    return NextResponse.json({ error: `La fusión no terminó: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
