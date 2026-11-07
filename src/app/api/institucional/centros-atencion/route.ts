// ─────────────────────────────────────────────────────────────
// /api/institucional/centros-atencion — CentrosAtención de una empresa en CONVENIO (src/lib/centros-atencion.ts)
//   POST   { empresa_id, nombre }          → crea
//   PATCH  { id, nombre?, is_active? }     → renombra, desactiva o reactiva
//   DELETE { id }                          → elimina (solo si nunca tuvo personas; si no, se desactiva)
// Acceso: Persona Institucional User/Superuser de ESA empresa, o el superadmin (autorizar-empresa.ts).
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import { autorizarEmpresa } from '@/lib/autorizar-empresa'

const RUTA = '/api/institucional/centros-atencion'
const noAutorizado = () => NextResponse.json({ error: 'No tienes permiso en esta empresa.' }, { status: 403 })

function limpiarNombre(nombre: unknown): string | null {
  if (typeof nombre !== 'string') return null
  const n = nombre.trim().replace(/\s+/g, ' ')
  return n.length >= 1 && n.length <= 80 ? n : null
}

function errorDeGuardado(e: { code?: string; message: string }) {
  if (e.code === '23505') return NextResponse.json({ error: 'Ya existe un CentroAtención con ese nombre en esta empresa.' }, { status: 409 })
  return NextResponse.json({ error: e.message }, { status: 500 })
}

/** Empresa del centro (para autorizar) */
async function empresaDelCentro(id: unknown): Promise<string | null> {
  if (typeof id !== 'string' || !id) return null
  const { data } = await createAdminClient().from('empresa_centros_atencion').select('empresa_id').eq('id', id).maybeSingle()
  return (data?.empresa_id as string) ?? null
}

export async function POST(req: NextRequest) {
  const { empresa_id, nombre } = await req.json()
  const auth = await autorizarEmpresa(empresa_id)
  if (!auth) return noAutorizado()
  const n = limpiarNombre(nombre)
  if (!n) return NextResponse.json({ error: 'Escribe el nombre del CentroAtención (máx. 80 letras).' }, { status: 400 })

  const { data, error } = await createAdminClient().from('empresa_centros_atencion')
    .insert({ empresa_id, nombre: n }).select('id, empresa_id, nombre, is_active').single()
  if (error) return errorDeGuardado(error)
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'POST', { empresa_id, centro_id: data.id, nombre: n })
  return NextResponse.json({ centro: data })
}

export async function PATCH(req: NextRequest) {
  const { id, nombre, is_active } = await req.json()
  const auth = await autorizarEmpresa(await empresaDelCentro(id))
  if (!auth) return noAutorizado()

  const updates: Record<string, unknown> = {}
  if (nombre !== undefined) {
    const n = limpiarNombre(nombre)
    if (!n) return NextResponse.json({ error: 'Escribe el nombre del CentroAtención (máx. 80 letras).' }, { status: 400 })
    updates.nombre = n
  }
  if (typeof is_active === 'boolean') updates.is_active = is_active
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nada que guardar' }, { status: 400 })

  const { error } = await createAdminClient().from('empresa_centros_atencion').update(updates).eq('id', id)
  if (error) return errorDeGuardado(error)
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'PATCH', { centro_id: id, ...updates })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const auth = await autorizarEmpresa(await empresaDelCentro(id))
  if (!auth) return noAutorizado()
  const admin = createAdminClient()

  // Con personas (aun archivadas) se conserva para los reportes: solo se desactiva
  const { count } = await admin.from('therapist_patients').select('id', { count: 'exact', head: true }).eq('centro_id', id)
  if (count) {
    return NextResponse.json({ error: `Tiene ${count} ${count === 1 ? 'persona' : 'personas'} en su historia: no se puede eliminar, solo desactivar.` }, { status: 409 })
  }
  const { error } = await admin.from('empresa_centros_atencion').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'DELETE', { centro_id: id })
  return NextResponse.json({ ok: true })
}
