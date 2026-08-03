// ─────────────────────────────────────────────────────────────
// /api/admin/convenio-empresas — solo admin
// GET  → lista todas las empresas
// POST → crea una empresa
// PATCH → activa/desactiva una empresa
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'pepe.vargas.papa@gmail.com'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await service
    .from('convenio_empresas')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ empresas: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { nombre } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await service
    .from('convenio_empresas')
    .insert({ nombre: nombre.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ empresa: data })
}

export async function PATCH(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, is_active } = await req.json()
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error } = await service
    .from('convenio_empresas')
    .update({ is_active })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
