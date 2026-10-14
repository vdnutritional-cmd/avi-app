// ─────────────────────────────────────────────────────────────
// /api/institucional/alta-baja — Alta/Baja de <Pros> en una empresa en CONVENIO
//   POST   { empresa_id, therapist_id } o { empresa_id, email }  → alta (therapist_empresa)
//   DELETE { empresa_id, therapist_id }                          → baja
// Acceso: Persona Institucional User/Superuser de ESA empresa, o el superadmin
// (src/lib/autorizar-empresa.ts). Regla "la empresa paga": con el alta, el terapeuta
// entra a AVI con su empresa aunque no tenga plan propio.
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import { autorizarEmpresa } from '@/lib/autorizar-empresa'

const RUTA = '/api/institucional/alta-baja'
const noAutorizado = () => NextResponse.json({ error: 'No tienes permiso en esta empresa.' }, { status: 403 })

export async function POST(req: NextRequest) {
  const { empresa_id, therapist_id, email } = await req.json()
  const auth = await autorizarEmpresa(empresa_id)
  if (!auth) return noAutorizado()
  const admin = createAdminClient()

  // Por id (ya aparece en la lista) o por el correo con que se registró en AVI
  let query = admin.from('profiles').select('id, full_name, role')
  if (typeof therapist_id === 'string' && therapist_id) query = query.eq('id', therapist_id)
  else if (typeof email === 'string' && email.trim()) query = query.ilike('email', email.trim())
  else return NextResponse.json({ error: 'Escribe el correo del terapeuta.' }, { status: 400 })

  const { data: perfiles } = await query.limit(1)
  const perfil = perfiles?.[0]
  if (!perfil || perfil.role !== 'therapist') {
    return NextResponse.json({ error: 'Ese correo no está registrado como terapeuta en AVI. Pídele que primero se registre en AVI.' }, { status: 404 })
  }

  const { error } = await admin.from('therapist_empresa').upsert(
    { therapist_id: perfil.id, empresa_id },
    { onConflict: 'therapist_id,empresa_id', ignoreDuplicates: true },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'POST', { empresa_id, therapist_id: perfil.id })
  return NextResponse.json({ ok: true, nombre: perfil.full_name })
}

export async function DELETE(req: NextRequest) {
  const { empresa_id, therapist_id } = await req.json()
  const auth = await autorizarEmpresa(empresa_id)
  if (!auth) return noAutorizado()
  if (typeof therapist_id !== 'string' || !therapist_id) return NextResponse.json({ error: 'Falta el terapeuta.' }, { status: 400 })

  const { error, count } = await createAdminClient()
    .from('therapist_empresa')
    .delete({ count: 'exact' })
    .eq('therapist_id', therapist_id)
    .eq('empresa_id', empresa_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'Ese terapeuta ya no está en esta empresa.' }, { status: 404 })
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'DELETE', { empresa_id, therapist_id })
  return NextResponse.json({ ok: true })
}
