import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/auth/confirm-patient
 * Crea al paciente COMPLETAMENTE server-side via SDK auth.admin.createUser().
 * Si el email ya existe (AuthApiError code 422), busca el usuario existente.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, codeId, therapistId, empresaId } = await req.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Crear usuario con email ya confirmado usando SDK admin
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'patient' },
    })

    let userId: string | undefined

    if (createError) {
      // Código 422 = usuario ya existe → buscar su ID y actualizar contraseña
      if (createError.status === 422 || createError.message?.toLowerCase().includes('already')) {
        const { data: existing } = await admin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single()
        userId = existing?.id
        if (!userId) {
          return NextResponse.json(
            { error: `Usuario ya existe pero sin perfil: ${createError.message}` },
            { status: 500 },
          )
        }
        // Actualizar la contraseña a la nueva que el paciente ingresó
        const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password })
        if (pwError) {
          console.error('[confirm-patient] Error actualizando contraseña:', pwError.message)
        }
      } else {
        return NextResponse.json(
          { error: `Error al crear cuenta: ${createError.message}` },
          { status: 500 },
        )
      }
    } else {
      userId = created?.user?.id
    }

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
      const { error: linkError } = await admin
        .from('therapist_patients')
        .insert({
          therapist_id: therapistId,
          patient_id: userId,
          authorization_code_id: codeId ?? null,
          empresa_id: empresaId ?? null,
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
