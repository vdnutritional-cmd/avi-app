// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/terapeutas-empresa?empresa_id=xxx
// Devuelve los terapeutas vinculados a una empresa (via therapist_empresa).
// Solo accesible por el administrador.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'pepe.vargas.papa@gmail.com'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id requerido' }, { status: 400 })

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('therapist_empresa')
    .select('therapist_id, profiles(id, full_name, email)')
    .eq('empresa_id', empresa_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const terapeutas = (data ?? []).map(r => {
    const p = r.profiles as { id?: string; full_name?: string; email?: string } | null
    return {
      id:     r.therapist_id as string,
      nombre: p?.full_name ?? '',
      email:  p?.email     ?? '',
    }
  }).filter(t => t.id)

  return NextResponse.json({ terapeutas })
}
