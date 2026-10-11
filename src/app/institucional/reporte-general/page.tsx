// Reporte Institucional General (Persona Institucional) — el contenido vive en
// ReporteGeneralContenido, compartido con Administración Institucional AVI.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { NIVELES_REPORTE_GENERAL } from '@/lib/niveles-institucionales'
import ReporteGeneralContenido from './ReporteGeneralContenido'

export const dynamic = 'force-dynamic'

export default async function ReporteGeneralPage({
  searchParams,
}: {
  searchParams: Promise<{ empresaIds?: string; mes?: string; tipo?: string; pid?: string }>
}) {
  const params = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const [{ data: piRecords }, { data: piProfile }] = await Promise.all([
    admin
      .from('convenio_personas_institucionales')
      .select('empresa_id, convenio_empresas(nombre, logo_url)')
      .eq('therapist_id', user.id)
      .eq('is_active', true)
      .in('nivel', NIVELES_REPORTE_GENERAL),   // solo empresas donde su nivel permite este reporte
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single(),
  ])

  if (!piRecords || piRecords.length === 0) redirect('/institucional/dashboard')

  const piNombre = piProfile?.full_name || piProfile?.email || 'Persona Institucional'

  const empresas = piRecords.map(r => {
    const e = r.convenio_empresas as { nombre?: string; logo_url?: string | null } | null
    return { id: r.empresa_id as string, nombre: e?.nombre ?? 'Empresa', logo_url: e?.logo_url ?? null }
  })

  return (
    <ReporteGeneralContenido
      empresas={empresas}
      piNombre={piNombre}
      basePath="/institucional/reporte-general"
      searchParams={params}
    />
  )
}
