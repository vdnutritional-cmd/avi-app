import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEmpresasDeTerapeuta } from '@/lib/empresas-terapeuta'
import { mensajeEmailPacienteExistente } from '@/lib/registro-email'

/**
 * POST /api/auth/confirm-patient
 * Crea al paciente COMPLETAMENTE server-side via SDK auth.admin.createUser().
 * El terapeuta se toma del código de autorización (no del navegador).
 * Si el correo ya existe NO se toca esa cuenta: se informa y se detiene.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, codeId, empresaId } = await req.json()

    if (!email || !password || !fullName || !codeId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 0. Validar el código de autorización y obtener su terapeuta
    const { data: codeRow } = await admin
      .from('authorization_codes')
      .select('id, therapist_id, is_active, used_by, expires_at')
      .eq('id', codeId)
      .maybeSingle()
    if (!codeRow || !codeRow.is_active || codeRow.used_by ||
        (codeRow.expires_at && new Date(codeRow.expires_at) < new Date())) {
      return NextResponse.json({ error: 'El código de acceso no es válido, ya fue usado o expiró.' }, { status: 400 })
    }
    const therapistId = codeRow.therapist_id as string

    // 1. El correo no debe existir (no se revela con qué terapeuta está un paciente)
    const yaExiste = await mensajeEmailPacienteExistente(admin, email, therapistId)
    if (yaExiste) return NextResponse.json({ error: yaExiste }, { status: 409 })

    // 2. Crear usuario con email ya confirmado usando SDK admin
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'patient' },
    })

    if (createError) {
      const duplicado = createError.status === 422 || createError.message?.toLowerCase().includes('already')
      return NextResponse.json(
        { error: duplicado ? 'Este correo ya está registrado en AVI. Usa otro correo para el registro.' : `Error al crear cuenta: ${createError.message}` },
        { status: duplicado ? 409 : 500 },
      )
    }

    const userId = created?.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'No se obtuvo ID de usuario' }, { status: 500 })
    }

    // 2. Marcar código como usado
    if (codeId) {
      const { error: codeError } = await admin
        .from('authorization_codes')
        .update({ used_by: userId, used_at: new Date().toISOString(), is_active: false })
        .eq('id', codeId)
      if (codeError) console.error('[confirm-patient] código:', codeError.message)
    }

    // 3. Vincular paciente con terapeuta (incluye empresa si el paciente seleccionó una)
    if (therapistId) {
      // La empresa solo se acepta si es una empresa CONVENIO activa del propio terapeuta
      const empresasTerapeuta = empresaId ? await getEmpresasDeTerapeuta(admin, therapistId) : []
      const empresaValida = empresaId && empresasTerapeuta.some(e => e.id === empresaId) ? empresaId : null

      const { error: linkError } = await admin
        .from('therapist_patients')
        .insert({
          therapist_id: therapistId,
          patient_id: userId,
          authorization_code_id: codeId ?? null,
          empresa_id: empresaValida,
        })

      if (linkError) {
        // Código 23505 = duplicate key: el paciente ya está vinculado a este terapeuta.
        // Es un caso válido (paciente registrándose con un código adicional del mismo terapeuta).
        // Cualquier otro error sí es inesperado y se reporta.
        if (linkError.code === '23505') {
          console.log(`[confirm-patient] Paciente ${userId} ya vinculado al terapeuta ${therapistId} — vínculo existente conservado.`)
        } else {
          console.error('[confirm-patient] Error inesperado al crear vínculo:', linkError)
          return NextResponse.json(
            { error: `Error al vincular paciente con terapeuta: ${linkError.message}` },
            { status: 500 },
          )
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[confirm-patient] Error inesperado:', msg)
    return NextResponse.json({ error: `Error interno: ${msg}` }, { status: 500 })
  }
}
