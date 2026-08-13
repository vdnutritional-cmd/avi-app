// ─────────────────────────────────────────────────────────────
// /api/admin/therapist-empresa — solo admin
// GET    ?therapistId=xxx  → lista empresas del terapeuta
// POST   { therapistId, empresaId }  → agrega empresa
// DELETE { therapistId, empresaId }  → quita empresa
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

const service = () => createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — listar empresas de un terapeuta
export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const therapistId = req.nextUrl.searchParams.get('therapistId')
  if (!therapistId) return NextResponse.json({ error: 'therapistId requerido' }, { status: 400 })

  const { data, error } = await service()
    .from('therapist_empresa')
    .select('id, empresa_id, created_at, convenio_empresas(nombre)')
    .eq('therapist_id', therapistId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ empresas: data ?? [] })
}

// POST — agregar empresa a terapeuta
export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { therapistId, empresaId } = await req.json()
  if (!therapistId || !empresaId) return NextResponse.json({ error: 'therapistId y empresaId requeridos' }, { status: 400 })

  const { data, error } = await service()
    .from('therapist_empresa')
    .upsert({ therapist_id: therapistId, empresa_id: empresaId }, { onConflict: 'therapist_id,empresa_id', ignoreDuplicates: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, row: data })
}

// DELETE — quitar empresa de terapeuta
export async function DELETE(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { therapistId, empresaId } = await req.json()
  if (!therapistId || !empresaId) return NextResponse.json({ error: 'therapistId y empresaId requeridos' }, { status: 400 })

  const { error } = await service()
    .from('therapist_empresa')
    .delete()
    .eq('therapist_id', therapistId)
    .eq('empresa_id', empresaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
