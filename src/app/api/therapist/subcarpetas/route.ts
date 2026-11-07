import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'

/**
 * SubCarpetas del terapeuta (7 nov 2026, src/lib/subcarpetas.ts). Privadas: cada quien las suyas.
 *   POST   { nombre }                        → crea
 *   PATCH  { id, nombre }                    → renombra
 *   DELETE { id }                            → elimina (sus personas quedan sin SubCarpeta)
 *   PUT    { patient_id, subcarpeta_id|null } → pone a una persona en una SubCarpeta (o la saca)
 */
const RUTA = '/api/therapist/subcarpetas'

async function terapeuta() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'therapist' ? { supabase, user } : null
}

const noAutorizado = () => NextResponse.json({ error: 'No autorizado' }, { status: 401 })

function limpiarNombre(nombre: unknown): string | null {
  if (typeof nombre !== 'string') return null
  const n = nombre.trim().replace(/\s+/g, ' ')
  return n.length >= 1 && n.length <= 60 ? n : null
}

function errorDeGuardado(e: { code?: string; message: string }) {
  if (e.code === '23505') return NextResponse.json({ error: 'Ya tienes una SubCarpeta con ese nombre.' }, { status: 409 })
  return NextResponse.json({ error: e.message }, { status: 500 })
}

export async function POST(req: NextRequest) {
  const auth = await terapeuta()
  if (!auth) return noAutorizado()
  const n = limpiarNombre((await req.json()).nombre)
  if (!n) return NextResponse.json({ error: 'Escribe el nombre de la SubCarpeta (máx. 60 letras).' }, { status: 400 })

  const { data, error } = await createAdminClient().from('therapist_subcarpetas')
    .insert({ therapist_id: auth.user.id, nombre: n }).select('id, nombre').single()
  if (error) return errorDeGuardado(error)
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'POST', { subcarpeta_id: data.id })
  return NextResponse.json({ subcarpeta: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await terapeuta()
  if (!auth) return noAutorizado()
  const { id, nombre } = await req.json()
  const n = limpiarNombre(nombre)
  if (!n) return NextResponse.json({ error: 'Escribe el nombre de la SubCarpeta (máx. 60 letras).' }, { status: 400 })

  const { error, count } = await createAdminClient().from('therapist_subcarpetas')
    .update({ nombre: n }, { count: 'exact' }).eq('id', id).eq('therapist_id', auth.user.id)
  if (error) return errorDeGuardado(error)
  if (!count) return NextResponse.json({ error: 'SubCarpeta no encontrada' }, { status: 404 })
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'PATCH', { subcarpeta_id: id })
  return NextResponse.json({ ok: true, nombre: n })
}

export async function DELETE(req: NextRequest) {
  const auth = await terapeuta()
  if (!auth) return noAutorizado()
  const { id } = await req.json()
  // on delete set null: sus personas quedan sin SubCarpeta
  const { error, count } = await createAdminClient().from('therapist_subcarpetas')
    .delete({ count: 'exact' }).eq('id', id).eq('therapist_id', auth.user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'SubCarpeta no encontrada' }, { status: 404 })
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'DELETE', { subcarpeta_id: id })
  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest) {
  const auth = await terapeuta()
  if (!auth) return noAutorizado()
  const { patient_id, subcarpeta_id } = await req.json()
  if (typeof patient_id !== 'string' || !patient_id) return NextResponse.json({ error: 'Falta la persona' }, { status: 400 })
  const admin = createAdminClient()

  if (subcarpeta_id) {
    const { data: sub } = await admin.from('therapist_subcarpetas').select('id')
      .eq('id', subcarpeta_id).eq('therapist_id', auth.user.id).maybeSingle()
    if (!sub) return NextResponse.json({ error: 'SubCarpeta no encontrada' }, { status: 404 })
  }
  const { error, count } = await admin.from('therapist_patients')
    .update({ subcarpeta_id: subcarpeta_id || null }, { count: 'exact' })
    .eq('therapist_id', auth.user.id).eq('patient_id', patient_id).neq('status', 'archived')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'PUT', { patient_id, subcarpeta_id: subcarpeta_id || null })
  return NextResponse.json({ ok: true })
}
