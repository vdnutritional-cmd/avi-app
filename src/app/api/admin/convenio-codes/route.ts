// ─────────────────────────────────────────────────────────────
// /api/admin/convenio-codes
// Solo accesible por el administrador de AVI.
// GET  → lista todos los códigos
// POST → genera un nuevo código
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generarCodigoConvenio } from '@/lib/companion'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'pepe.vargas.papa@gmail.com'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── GET — listar códigos ──────────────────────────────────────
export async function GET() {
  const user = await getAdminUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // used_by apunta a auth.users → no se puede embeber; el nombre se busca aparte en profiles
  const { data, error } = await service
    .from('convenio_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enriquecer con nombre/email del terapeuta que usó el código
  const usedIds = [...new Set((data ?? []).map(r => r.used_by).filter(Boolean))] as string[]
  const { data: profiles } = usedIds.length > 0
    ? await service.from('profiles').select('id, full_name, email').in('id', usedIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] }

  const enriched = (data ?? []).map(row => ({
    ...row,
    used_by_name: profiles?.find(p => p.id === row.used_by)?.full_name ?? null,
    used_by_email: profiles?.find(p => p.id === row.used_by)?.email ?? null,
  }))

  return NextResponse.json({ codes: enriched })
}

// ── POST — crear código ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { planId, expiresAt } = body as { planId?: string; expiresAt?: string }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Generar código único (reintenta si hay colisión)
  let code = ''
  let attempts = 0
  while (attempts < 5) {
    code = generarCodigoConvenio()
    const { data: existing } = await service
      .from('convenio_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!existing) break
    attempts++
  }

  const { data, error } = await service
    .from('convenio_codes')
    .insert({
      code,
      plan_id: planId ?? null,
      expires_at: expiresAt ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code: data })
}

// ── PATCH — desactivar código ─────────────────────────────────
export async function PATCH(req: NextRequest) {
  const user = await getAdminUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id, is_active } = await req.json()

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await service
    .from('convenio_codes')
    .update({ is_active })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
