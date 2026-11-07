// ─────────────────────────────────────────────────────────────
// /api/institucional/centros-atencion/terapeuta — asignar un terapeuta a un CentroAtención
//   POST   { centro_id, therapist_id }  → lo asigna (debe estar dado de alta en la empresa del centro)
//   DELETE { centro_id, therapist_id }  → lo quita (sus personas se quedan en el CentroAtención)
// Al asignarlo, si es su único CentroAtención activo en esa empresa, sus personas activas de esa
// empresa que aún no tenían CentroAtención quedan en él (así se ordena lo que ya existía).
// Acceso: Persona Institucional User/Superuser de esa empresa, o el superadmin.
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import { autorizarEmpresa } from '@/lib/autorizar-empresa'
import { centroPorDefecto } from '@/lib/centros-atencion'

const RUTA = '/api/institucional/centros-atencion/terapeuta'
const noAutorizado = () => NextResponse.json({ error: 'No tienes permiso en esta empresa.' }, { status: 403 })

async function leer(req: NextRequest) {
  const { centro_id, therapist_id } = await req.json()
  if (typeof centro_id !== 'string' || typeof therapist_id !== 'string' || !centro_id || !therapist_id) return null
  const { data: centro } = await createAdminClient().from('empresa_centros_atencion')
    .select('id, empresa_id, nombre, is_active').eq('id', centro_id).maybeSingle()
  return centro ? { centro, therapist_id } : null
}

export async function POST(req: NextRequest) {
  const datos = await leer(req)
  if (!datos) return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 })
  const { centro, therapist_id } = datos
  const auth = await autorizarEmpresa(centro.empresa_id)
  if (!auth) return noAutorizado()
  if (!centro.is_active) return NextResponse.json({ error: 'Ese CentroAtención está desactivado.' }, { status: 400 })
  const admin = createAdminClient()

  const { data: rel } = await admin.from('therapist_empresa').select('id')
    .eq('therapist_id', therapist_id).eq('empresa_id', centro.empresa_id).maybeSingle()
  if (!rel) return NextResponse.json({ error: 'Primero da de alta a esta persona en la empresa.' }, { status: 400 })

  const { error } = await admin.from('therapist_centro_atencion').upsert(
    { therapist_id, centro_id: centro.id },
    { onConflict: 'therapist_id,centro_id', ignoreDuplicates: true },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Único CentroAtención en la empresa → sus personas sin CentroAtención quedan en él
  let personasAsignadas = 0
  if (await centroPorDefecto(admin, therapist_id, centro.empresa_id) === centro.id) {
    const { count } = await admin.from('therapist_patients')
      .update({ centro_id: centro.id }, { count: 'exact' })
      .eq('therapist_id', therapist_id).eq('empresa_id', centro.empresa_id)
      .is('centro_id', null).neq('status', 'archived')
    personasAsignadas = count ?? 0
  }

  logApiAccess(auth.supabase, auth.user.id, RUTA, 'POST', { centro_id: centro.id, therapist_id, personasAsignadas })
  return NextResponse.json({ ok: true, personasAsignadas })
}

export async function DELETE(req: NextRequest) {
  const datos = await leer(req)
  if (!datos) return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 })
  const { centro, therapist_id } = datos
  const auth = await autorizarEmpresa(centro.empresa_id)
  if (!auth) return noAutorizado()

  const { error } = await createAdminClient().from('therapist_centro_atencion')
    .delete().eq('therapist_id', therapist_id).eq('centro_id', centro.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'DELETE', { centro_id: centro.id, therapist_id })
  return NextResponse.json({ ok: true })
}
