// Administración Institucional AVI › Reporte por Terapeuta
// Mismo contenido que ve una Persona Institucional N1 (ReporteTerapeutaContenido),
// con todas las Empresas en Convenio. Acceso: superadmin (admin/layout.tsx).
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import ReporteTerapeutaContenido from '@/app/institucional/reporte-terapeuta/ReporteTerapeutaContenido'
import EncabezadoAVI from '../EncabezadoAVI'
import { cargarEmpresasAVI, resolverSeleccion, SIN_EMPRESA } from '../empresas-avi'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ empresaIds?: string; terapeutaId?: string; mes?: string; tipo?: string; pid?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const empresas = await cargarEmpresasAVI(admin)
  // Los reportes son por empresa: "Sin empresa" no aplica (se desmarca)
  const selectedIds = resolverSeleccion(empresas, params.empresaIds).filter(id => id !== SIN_EMPRESA)
  if (user) logApiAccess(supabase, user.id, '/admin/institucional/reporte-terapeuta', 'GET', { empresa_ids: selectedIds })

  return (
    <div className="space-y-8">
      <EncabezadoAVI actual="/admin/institucional/reporte-terapeuta" empresas={empresas} selectedIds={selectedIds} mes={params.mes} />
      <ReporteTerapeutaContenido
        empresas={empresas}
        piNombre="AVI Administración"
        basePath="/admin/institucional/reporte-terapeuta"
        searchParams={{ ...params, empresaIds: selectedIds.join(',') }}
        ocultarSelectorEmpresas
      />
    </div>
  )
}
