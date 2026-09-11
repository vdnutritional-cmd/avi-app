import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/registro-consultorio
 * Registra un paciente nuevo usando el token del terapeuta.
 * Crea la cuenta, el perfil y la vinculación therapist_patients en un solo paso.
 */
export async function POST(req: NextRequest) {
  const { token, fullName, email, password, whatsapp } = await req.json()

  if (!token || !fullName || !email || !password) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── 1. Validar token y obtener terapeuta ──────────────────────────────────
  const { data: therapistProfile, error: tokenErr } = await admin
    .from('profiles')
    .select('id, full_name, registro_token')
    .eq('registro_token', token)
    .eq('role', 'therapist')
    .single()

  if (tokenErr || !therapistProfile) {
    return NextResponse.json(
      { error: 'El código de registro no es válido o ha expirado.' },
      { status: 404 }
    )
  }

  // ── 2. Crear usuario en Supabase Auth ─────────────────────────────────────
  const { data: authData, error: signUpErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,   // Auto-confirmado (es registro presencial, terapeuta presente)
    user_metadata: {
      full_name: fullName,
      role: 'patient',
      whatsapp_phone: whatsapp ?? '',
    },
  })

  if (signUpErr || !authData?.user) {
    // Error más común: email ya registrado
    const msg = signUpErr?.message?.includes('already')
      ? 'Este correo ya tiene una cuenta en AVI. Inicia sesión directamente.'
      : (signUpErr?.message ?? 'Error al crear la cuenta')
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const patientId = authData.user.id

  // ── 3. Crear perfil del paciente ──────────────────────────────────────────
  const { error: profileErr } = await admin.from('profiles').upsert({
    id: patientId,
    full_name: fullName,
    email,
    role: 'patient',
    whatsapp_phone: whatsapp ?? '',
  })

  if (profileErr) {
    console.error('[registro-consultorio] Error creando perfil:', profileErr)
    // No bloqueamos el flujo — el trigger de Supabase suele crear el perfil
  }

  // ── 4. Vincular paciente con terapeuta ────────────────────────────────────
  const { error: linkErr } = await admin.from('therapist_patients').insert({
    therapist_id: therapistProfile.id,
    patient_id: patientId,
    status: 'active',
    is_active: true,
  })

  if (linkErr) {
    console.error('[registro-consultorio] Error vinculando paciente:', linkErr)
    // Continúa — el terapeuta puede vincular manualmente desde el panel
  }

  // ── 5. Iniciar sesión del paciente (para que entre directo a AVI) ─────────
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })

  if (signInErr) {
    // Cuenta creada pero no pudo hacer login automático — pedir que inicie sesión manualmente
    return NextResponse.json(
      { ok: true, autoLogin: false, therapistName: therapistProfile.full_name },
      { status: 200 }
    )
  }

  return NextResponse.json(
    { ok: true, autoLogin: true, therapistName: therapistProfile.full_name },
    { status: 200 }
  )
}

/**
 * GET /api/auth/registro-consultorio?t=TOKEN
 * Valida el token y devuelve el nombre del terapeuta (para mostrar en el formulario).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('full_name')
    .eq('registro_token', token)
    .eq('role', 'therapist')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
  }

  return NextResponse.json({ therapistName: data.full_name })
}
