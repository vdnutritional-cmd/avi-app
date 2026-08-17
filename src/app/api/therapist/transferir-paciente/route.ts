import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ── GET — vista previa del traslado ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const patientId            = searchParams.get('patientId')
  const emailReceptor        = searchParams.get('emailReceptor')

  if (!patientId || !emailReceptor) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  // Verificar que el paciente pertenece al terapeuta solicitante
  const { data: tp } = await supabase
    .from('therapist_patients')
    .select('patient_id, is_active, status')
    .eq('therapist_id', user.id)
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .single()

  if (!tp) {
    return NextResponse.json({ error: 'Paciente no encontrado en tu lista activa' }, { status: 404 })
  }

  // Buscar terapeuta receptor por email
  const admin = createAdminClient()
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const receptorUser = allUsers.find(u => u.email === emailReceptor.toLowerCase().trim())
  if (!receptorUser) {
    return NextResponse.json({ error: `No existe una cuenta AVI con el correo: ${emailReceptor}` }, { status: 404 })
  }
  if (receptorUser.id === user.id) {
    return NextResponse.json({ error: 'No puedes transferir a tu propia cuenta' }, { status: 400 })
  }

  // Datos del receptor
  const { data: receptorProfile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', receptorUser.id)
    .single()

  // Datos del paciente
  const { data: pacienteProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', patientId)
    .single()

  // Conteos de lo que se trasladará
  const [
    { count: sesionesCount },
    { count: analysesCount },
    { data: expediente },
  ] = await Promise.all([
    supabase.from('therapist_session_notes')
      .select('*', { count: 'exact', head: true })
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId),
    supabase.from('analyses')
      .select('*', { count: 'exact', head: true })
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId),
    supabase.from('patient_expediente')
      .select('tipo_caso')
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .single(),
  ])

  return NextResponse.json({
    paciente: {
      id: patientId,
      nombre: pacienteProfile?.full_name ?? pacienteProfile?.email ?? patientId,
      email: pacienteProfile?.email,
    },
    receptor: {
      id: receptorUser.id,
      nombre: receptorProfile?.full_name ?? emailReceptor,
      email: emailReceptor,
    },
    resumen: {
      sesionesPresenciales: sesionesCount ?? 0,
      analisis:             analysesCount ?? 0,
      tieneExpediente:      !!expediente,
    },
  })
}

// ── POST — ejecutar el traslado ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { patientId, emailReceptor, modalidad } = body as {
    patientId:     string
    emailReceptor: string
    modalidad:     'completo' | 'compartido'
  }

  if (!patientId || !emailReceptor || !modalidad) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  // Verificar vínculo activo
  const { data: tpOrigen } = await supabase
    .from('therapist_patients')
    .select('*')
    .eq('therapist_id', user.id)
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .single()

  if (!tpOrigen) {
    return NextResponse.json({ error: 'Paciente no encontrado en tu lista activa' }, { status: 404 })
  }

  // Buscar receptor
  const admin = createAdminClient()
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const receptorUser = allUsers.find(u => u.email === emailReceptor.toLowerCase().trim())
  if (!receptorUser) {
    return NextResponse.json({ error: `No existe una cuenta AVI con el correo: ${emailReceptor}` }, { status: 404 })
  }

  const receptorId = receptorUser.id

  // ── 1. Crear vínculo para el receptor (o actualizar si ya existe) ──────────
  const NOTA_FIELDS = [
    'initial_note', 'initial_note_date', 'initial_note_pro_bono', 'initial_note_virtual',
    'initial_note_motivo', 'initial_note_subyacente', 'initial_note_premisas',
    'empresa_id',
  ] as const

  const nuevoVinculo: Record<string, unknown> = {
    therapist_id: receptorId,
    patient_id:   patientId,
    is_active:    true,
    status:       'active',
  }
  for (const field of NOTA_FIELDS) {
    if (tpOrigen[field] !== undefined && tpOrigen[field] !== null) {
      nuevoVinculo[field] = tpOrigen[field]
    }
  }

  const { error: vinculoError } = await supabase
    .from('therapist_patients')
    .upsert(nuevoVinculo, { onConflict: 'therapist_id,patient_id' })

  if (vinculoError) {
    return NextResponse.json({ error: 'Error al crear vínculo: ' + vinculoError.message }, { status: 500 })
  }

  // ── 2. Copiar sesiones presenciales ───────────────────────────────────────
  const { data: sesiones } = await supabase
    .from('therapist_session_notes')
    .select('*')
    .eq('therapist_id', user.id)
    .eq('patient_id', patientId)

  if (sesiones && sesiones.length > 0) {
    const nuevasSesiones = sesiones.map(({ id: _id, created_at: _ca, ...rest }) => ({
      ...rest,
      therapist_id: receptorId,
    }))
    await supabase.from('therapist_session_notes').insert(nuevasSesiones)
  }

  // ── 3. Copiar análisis ────────────────────────────────────────────────────
  const { data: analisis } = await supabase
    .from('analyses')
    .select('*')
    .eq('therapist_id', user.id)
    .eq('patient_id', patientId)

  if (analisis && analisis.length > 0) {
    const nuevosAnalisis = analisis.map(({ id: _id, created_at: _ca, ...rest }) => ({
      ...rest,
      therapist_id: receptorId,
    }))
    await supabase.from('analyses').insert(nuevosAnalisis)
  }

  // ── 4. Copiar expediente ──────────────────────────────────────────────────
  const { data: expediente } = await supabase
    .from('patient_expediente')
    .select('*')
    .eq('therapist_id', user.id)
    .eq('patient_id', patientId)
    .single()

  if (expediente) {
    const { id: _id, created_at: _ca, updated_at: _ua, ...expRest } = expediente
    await supabase.from('patient_expediente').upsert({
      ...expRest,
      therapist_id: receptorId,
    }, { onConflict: 'therapist_id,patient_id' })
  }

  // ── 5. Si es traslado completo: marcar vínculo original como transferred ──
  if (modalidad === 'completo') {
    await supabase
      .from('therapist_patients')
      .update({ is_active: false, status: 'transferred' })
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
  }

  return NextResponse.json({
    ok: true,
    modalidad,
    mensaje: modalidad === 'completo'
      ? 'Traslado completo realizado. El paciente ya no aparece en tu lista activa.'
      : 'Traslado compartido realizado. Ambos terapeutas tienen acceso al paciente.',
  })
}
