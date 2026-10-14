// ─────────────────────────────────────────────────────────────
// /api/institucional/empresa-config — Configuración Admin de una empresa en CONVENIO
//   PATCH  { empresa_id, terminologia?, telefono?, telefono_solicitudes? }
//   POST   multipart { empresa_id, file }  → sube o cambia el logo
//   DELETE ?empresa_id=…                   → quita el logo
// Acceso: Persona Institucional activa con nivel User o Superuser (N2/N1) EN ESA
// empresa, o el superadmin (SaaS Controller › AVI Administración).
// El logo se sube desde el servidor (service role): el navegador no escribe en Storage.
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import { autorizarEmpresa as autorizar } from '@/lib/autorizar-empresa'

const BUCKET = 'empresa-logos'
const RUTA = '/api/institucional/empresa-config'
const TIPOS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const MAX_BYTES = 2 * 1024 * 1024

const noAutorizado = () => NextResponse.json({ error: 'No tienes permiso para configurar esta empresa.' }, { status: 403 })

export async function PATCH(req: NextRequest) {
  const { empresa_id, terminologia, telefono, telefono_solicitudes } = await req.json()
  const auth = await autorizar(empresa_id)
  if (!auth) return noAutorizado()

  const updates: Record<string, unknown> = {}
  if (terminologia !== undefined) {
    if (terminologia !== 'paciente' && terminologia !== 'asesorado') {
      return NextResponse.json({ error: 'Terminología no válida' }, { status: 400 })
    }
    updates.terminologia = terminologia
  }
  if (telefono !== undefined) {
    updates.telefono = typeof telefono === 'string' && telefono.trim() ? telefono.trim().slice(0, 40) : null
  }
  if (telefono_solicitudes !== undefined) {
    updates.telefono_solicitudes = typeof telefono_solicitudes === 'string' && telefono_solicitudes.trim()
      ? telefono_solicitudes.trim().slice(0, 40) : null
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nada que guardar' }, { status: 400 })

  const { error } = await createAdminClient().from('convenio_empresas').update(updates).eq('id', empresa_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'PATCH', { empresa_id, ...updates })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const empresaId = form.get('empresa_id')
  const file = form.get('file')
  const auth = await autorizar(empresaId)
  if (!auth) return noAutorizado()
  if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
  const ext = TIPOS[file.type]
  if (!ext) return NextResponse.json({ error: 'Solo PNG, JPG o WebP.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El archivo no debe superar 2 MB.' }, { status: 400 })

  const admin = createAdminClient()
  const storage = admin.storage.from(BUCKET)
  // Un solo logo por empresa: se quitan los de otra extensión
  await storage.remove(Object.values(TIPOS).filter(e => e !== ext).map(e => `${empresaId}/logo.${e}`))
  const path = `${empresaId}/logo.${ext}`
  const { error: upErr } = await storage.upload(path, Buffer.from(await file.arrayBuffer()), { upsert: true, contentType: file.type })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const logoUrl = `${storage.getPublicUrl(path).data.publicUrl}?t=${Date.now()}`
  const { error } = await admin.from('convenio_empresas').update({ logo_url: logoUrl }).eq('id', empresaId as string)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'POST', { empresa_id: empresaId, logo: path })
  return NextResponse.json({ logo_url: logoUrl })
}

export async function DELETE(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get('empresa_id')
  const auth = await autorizar(empresaId)
  if (!auth) return noAutorizado()

  const admin = createAdminClient()
  await admin.storage.from(BUCKET).remove(Object.values(TIPOS).map(e => `${empresaId}/logo.${e}`))
  const { error } = await admin.from('convenio_empresas').update({ logo_url: null }).eq('id', empresaId as string)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  logApiAccess(auth.supabase, auth.user.id, RUTA, 'DELETE', { empresa_id: empresaId })
  return NextResponse.json({ ok: true })
}
