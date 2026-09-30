// GET /api/therapist/analisis-lista?pid=<patient_id>
// Devuelve la lista de análisis Consúltame de un paciente (para dropdown)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const pid = req.nextUrl.searchParams.get('pid')
  if (!pid) return NextResponse.json({ analisis: [] })

  const { data } = await supabase
    .from('analyses')
    .select('id, created_at')
    .eq('patient_id', pid)
    .eq('therapist_id', user.id)
    .order('created_at', { ascending: false })

  const analisis = (data ?? []).map(a => ({
    id:    a.id,
    fecha: (a.created_at as string).split('T')[0],
  }))

  return NextResponse.json({ analisis })
}
