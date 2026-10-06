// ─────────────────────────────────────────────────────────────
// GET /api/patient/contacto
// Datos de contacto para la bienvenida del paciente (onboarding).
// La regla vive en src/lib/patient-contacto.ts (compartida con el chat AVI).
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPatientContacto } from '@/lib/patient-contacto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  return NextResponse.json(await getPatientContacto(user.id))
}
