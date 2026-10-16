import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import PanelInstitucionalVista, { type EmpresaBlock } from './PanelInstitucionalVista'
import { permisosPI } from '@/lib/niveles-institucionales'
import { cargarTelefonos, cargarTerapeutasEmpresa } from './cargar-panel'
import { normalizarTerminologia } from '@/lib/terminologia'

// ── Página ─────────────────────────────────────────────────────────────────────
export default async function InstitucionalDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // Fetch todos los registros institucionales activos.
  // .maybeSingle() falla cuando hay más de una fila; usamos array.
  const { data: piRecords } = await admin
    .from('convenio_personas_institucionales')
    .select('nivel, opera_como_terapeuta, empresa_id, convenio_empresas(nombre, logo_url, terminologia)')
    .eq('therapist_id', user.id)
    .eq('is_active', true)

  if (!piRecords || piRecords.length === 0) redirect('/therapist/dashboard')

  // ── Teléfonos desde user_metadata ─────────────────────────────────────────
  const whatsappMap = await cargarTelefonos(admin)

  // ── Cargar terapeutas y pacientes por empresa ──────────────────────────────
  const empresaBlocks: EmpresaBlock[] = await Promise.all(
    piRecords.map(async (pi) => {
      const empresaId = pi.empresa_id as string
      const empresaData = pi.convenio_empresas as { nombre?: string; logo_url?: string | null; terminologia?: string | null } | null
      const empresaNombre  = empresaData?.nombre   ?? 'Empresa'
      const empresaLogoUrl = empresaData?.logo_url ?? null
      const nivel = pi.nivel as 'N1' | 'N2' | 'N3'

      const terapeutas = await cargarTerapeutasEmpresa(admin, empresaId, empresaNombre, whatsappMap)

      return { empresaId, empresaNombre, empresaLogoUrl, nivel, terminologia: normalizarTerminologia(empresaData?.terminologia), terapeutas }
    })
  )

  // Permisos por nivel (src/lib/niveles-institucionales.ts): N2+ Reporte General, N1 Reporte por Terapeuta
  const permisos = permisosPI(piRecords.map(r => r.nivel as string))

  return (
    <PanelInstitucionalVista
      empresaBlocks={empresaBlocks}
      permisos={permisos}
      hrefReporteGeneral="/institucional/reporte-general"
      hrefReporteTerapeuta="/institucional/reporte-terapeuta"
    />
  )
}
