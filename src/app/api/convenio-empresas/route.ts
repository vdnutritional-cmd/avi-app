// ─────────────────────────────────────────────────────────────
// GET /api/convenio-empresas
// Pública — devuelve la lista de empresas en CONVENIO activas
// para el dropdown en /pricing
//
// GET /api/convenio-empresas?codeId=<authorization_codes.id>
// Registro de paciente con código: solo las empresas activas del
// terapeuta dueño del código (igual que el registro por QR).
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEmpresasDeTerapeuta } from '@/lib/empresas-terapeuta'

export async function GET(req: NextRequest) {
  const codeId = req.nextUrl.searchParams.get('codeId')

  if (codeId) {
    const admin = createAdminClient()
    const { data: code } = await admin
      .from('authorization_codes')
      .select('therapist_id, is_active, used_by')
      .eq('id', codeId)
      .maybeSingle()
    if (!code || !code.is_active || code.used_by) return NextResponse.json({ empresas: [] })
    return NextResponse.json({ empresas: await getEmpresasDeTerapeuta(admin, code.therapist_id) })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('convenio_empresas')
    .select('id, nombre')
    .eq('is_active', true)
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ empresas: [] })
  return NextResponse.json({ empresas: data ?? [] })
}
