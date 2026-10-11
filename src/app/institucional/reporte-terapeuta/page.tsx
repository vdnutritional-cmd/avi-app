// Reporte por Terapeuta (Persona Institucional) — el contenido vive en
// ReporteTerapeutaContenido, compartido con Administración Institucional AVI.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { NIVELES_REPORTE_TERAPEUTA } from '@/lib/niveles-institucionales'
import ReporteTerapeutaContenido from './ReporteTerapeutaContenido'

export const dynamic = 'force-dynamic'

export default async function ReporteTerapeutaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresaIds?: string; empresaId?: string; terapeutaId?: string; mes?: string; tipo?: string; pid?: string }>
}) {
  const params = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // Verificar que es PI activo
  // + perfil de la PI (para "Reporte impreso por"), en paralelo
  const [{ data: piRecords }, { data: piProfile }] = await Promise.all([
    admin
      .from('convenio_personas_institucionales')
      .select('empresa_id, convenio_empresas(nombre, logo_url)')
      .eq('therapist_id', user.id)
      .eq('is_active', true)
      .in('nivel', NIVELES_REPORTE_TERAPEUTA),   // solo empresas donde su nivel permite este reporte
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single(),
  ])

  if (!piRecords || piRecords.length === 0) redirect('/institucional/dashboard')

  const piNombre = piProfile?.full_name || piProfile?.email || 'Persona Institucional'

  // Empresas de la PI
  const empresas = piRecords.map(r => {
    const e = r.convenio_empresas as { nombre?: string; logo_url?: string | null } | null
    return { id: r.empresa_id as string, nombre: e?.nombre ?? 'Empresa', logo_url: e?.logo_url ?? null }
  })

  return (
    <ReporteTerapeutaContenido
      empresas={empresas}
      piNombre={piNombre}
      basePath="/institucional/reporte-terapeuta"
      searchParams={params}
    />
  )
}
