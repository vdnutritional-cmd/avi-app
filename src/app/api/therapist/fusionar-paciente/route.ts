// ─────────────────────────────────────────────────────────────
// /api/therapist/fusionar-paciente
//
// GET  ?emailOrigen=xxx&emailDestino=yyy
//      → Vista previa: qué se copiará (nota inicial + sesiones presenciales)
//
// POST { emailOrigen, emailDestino }
//      → Ejecuta la fusión:
//        1. Copia nota inicial de origen → destino (si destino no la tiene)
//        2. Reasigna sesiones presenciales de origen → destino
//        3. Archiva el registro origen (status = 'archived')
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Contar sesiones presenciales del origen
  const { count: sesionesCount } = await supabase
    .from('therapist_session_notes')
    .select('id', { count: 'exact', head: true })
    .eq('therapist_id', user.id)
    .eq('patient_id', origenId)

  const preview = {
    origen:  { email: emailOrigen,  id: origenId,  tieneNotaInicial: !!tpOrigen.initial_note,  fechaNota: tpOrigen.initial_note_date },
    destino: { email: emailDestino, id: destinoId, tieneNotaInicial: !!tpDestino.initial_note, fechaNota: tpDestino.initial_note_date },
    sesionesPresenciales: sesionesCount ?? 0,
    advertencias: [] as string[],
  }

  if (!tpOrigen.initial_note && (sesionesCount ?? 0) === 0) {
    preview.advertencias.push('La cuenta de origen no tiene nota inicial ni sesiones presenciales.')
  }
  if (tpDestino.initial_note) {
    preview.advertencias.push('La cuenta destino ya tiene una nota inicial — se conservará la del destino y se omitirá la del origen.')
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

  // ── 1. Copiar nota inicial (solo si destino no la tiene) ──
  if (tpOrigen.initial_note && !tpDestino.initial_note) {
    const notaFields: Record<string, unknown> = {}
    // Campos de nota inicial — copiar todos los que vengan del origen
    const NOTA_FIELDS = [
      'initial_note', 'initial_note_date', 'initial_note_pro_bono', 'initial_note_virtual',
      // campos estructurados (task #84)
      'initial_note_motivo', 'initial_note_antecedentes', 'initial_note_red_apoyo',
      // cualquier otro campo initial_note_* que exista
    ]
    for (const field of NOTA_FIELDS) {
      if (tpOrigen[field] !== undefined && tpOrigen[field] !== null) {
        notaFields[field] = tpOrigen[field]
      }
    }
    if (Object.keys(notaFields).length > 0) {
      await supabase.from('therapist_patients')
        .update(notaFields)
        .eq('therapist_id', user.id)
        .eq('patient_id', destinoId)
    }
  }

  // ── 2. Reasignar sesiones presenciales ────────────────────
  await supabase.from('therapist_session_notes')
    .update({ patient_id: destinoId })
    .eq('therapist_id', user.id)
    .eq('patient_id', origenId)

  // ── 3. Archivar cuenta origen ─────────────────────────────
  await supabase.from('therapist_patients')
    .update({ status: 'archived', is_active: false })
    .eq('therapist_id', user.id)
    .eq('patient_id', origenId)

  return NextResponse.json({
    ok: true,
    mensaje: 'Fusión completada. La cuenta de origen ha sido archivada.',
  })
}
