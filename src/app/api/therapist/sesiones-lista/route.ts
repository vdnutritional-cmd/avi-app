// GET /api/therapist/sesiones-lista?pid=<patient_id>
// Devuelve la lista de sesiones presenciales de un paciente (para dropdown)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const pid = req.nextUrl.searchParams.get('pid')
  if (!pid) return NextResponse.json({ sesiones: [] })

  const { data } = await supabase
    .from('therapist_session_notes')
    .select('id, session_number, session_date')
    .eq('therapist_id', user.id)
    .eq('patient_id', pid)
    .order('session_date', { ascending: true })

  const sesiones = (data ?? []).map(s => ({
    id:     s.id,
    number: s.session_number,
    date:   s.session_date,
  }))

  return NextResponse.json({ sesiones })
}
