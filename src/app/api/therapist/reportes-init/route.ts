// ─────────────────────────────────────────────────────────────
// GET /api/therapist/reportes-init
// Devuelve empresas y pacientes activos para el panel de reportes
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccesoTerapeuta, accesoDePaciente } from '@/lib/acceso-paciente'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const therapistId = user.id

  // ── Empresas con logo ─────────────────────────────────────────
  const { data: empresaRels } = await admin
    .from('therapist_empresa')
    .select('empresa_id, convenio_empresas(nombre, logo_url)')
    .eq('therapist_id', therapistId)

  const empresas = (empresaRels ?? []).map(r => {
    const e = r.convenio_empresas as { nombre?: string; logo_url?: string | null } | null
    return { id: r.empresa_id as string, nombre: e?.nombre ?? '', logo_url: e?.logo_url ?? null }
  })

  // ── Solo pacientes ACTIVOS (no archivados) ───────────────────
  const { data: relaciones } = await admin
    .from('therapist_patients')
    .select('patient_id, empresa_id')
    .eq('therapist_id', therapistId)
    .eq('is_active', true)
    .neq('status', 'archived')

  // Mapa patient_id → empresa_id para filtrado en el cliente
  const empresaMap: Record<string, string | null> = {}
  const pacienteIds = (relaciones ?? []).map(r => {
    empresaMap[r.patient_id as string] = (r.empresa_id as string | null) ?? null
    return r.patient_id as string
  })

  const { data: profiles } = pacienteIds.length > 0
    ? await admin.from('profiles').select('id, full_name, email').in('id', pacienteIds)
    : { data: [] }

  // Nivel y bloqueo por paciente (regla "la empresa paga")
  const acceso = await getAccesoTerapeuta(admin, therapistId)

  const pacientesActivos = (profiles ?? [])
    .map(p => {
      const empresa_id = empresaMap[p.id] ?? null
      const { tier, bloqueado } = accesoDePaciente(acceso, p.id, empresa_id)
      return {
        id:        p.id,
        nombre:    p.full_name ?? p.email ?? p.id,
        empresa_id,
        tier,
        bloqueado,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  return NextResponse.json({ empresas, pacientesActivos })
}
