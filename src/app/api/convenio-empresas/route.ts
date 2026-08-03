// ─────────────────────────────────────────────────────────────
// GET /api/convenio-empresas
// Pública — devuelve la lista de empresas en CONVENIO activas
// para el dropdown en /pricing
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
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
