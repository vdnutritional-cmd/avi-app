// ─────────────────────────────────────────────────────────────
// GET /api/convenio-empresas
// Pública — devuelve la lista de empresas en CONVENIO activas
// para el selector de /pricing y Activar plan, con su WhatsApp de solicitudes de alta
//
// GET /api/convenio-empresas?codeId=<authorization_codes.id>
// Registro de paciente con código: solo las empresas activas del
// terapeuta dueño del código (igual que el registro por QR), y la palabra
// de su menú para los avisos de código usado o vencido (Inventario, 15.13).
// Con el código usado no devuelve empresas, pero sí la palabra.
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEmpresasDeTerapeuta } from '@/lib/empresas-terapeuta'
import { getTerminologiaTerapeuta } from '@/lib/terminologia-paciente'

export async function GET(req: NextRequest) {
  const codeId = req.nextUrl.searchParams.get('codeId')

  if (codeId) {
    const admin = createAdminClient()
    const { data: code } = await admin
      .from('authorization_codes')
      .select('therapist_id, is_active, used_by')
      .eq('id', codeId)
      .maybeSingle()
    if (!code) return NextResponse.json({ empresas: [], terminologia: null })
    const terminologia = await getTerminologiaTerapeuta(admin, code.therapist_id)
    if (!code.is_active || code.used_by) return NextResponse.json({ empresas: [], terminologia })
    return NextResponse.json({ empresas: await getEmpresasDeTerapeuta(admin, code.therapist_id), terminologia })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('convenio_empresas')
    .select('id, nombre, telefono_solicitudes')
    .eq('is_active', true)
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ empresas: [] })
  return NextResponse.json({ empresas: data ?? [] })
}
