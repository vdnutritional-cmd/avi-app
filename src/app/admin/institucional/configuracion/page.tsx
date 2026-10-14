// SaaS Controller › AVI Administración › Configuración Admin
// La misma Configuración Admin de las Personas Institucionales, para las empresas
// elegidas en el selector común (el superadmin puede apoyar a cualquier empresa).
// Acceso: superadmin (admin/layout.tsx).
import { createAdminClient } from '@/lib/supabase/admin'
import EncabezadoAVI from '../EncabezadoAVI'
import { cargarEmpresasAVI, resolverSeleccion, SIN_EMPRESA } from '../empresas-avi'
import ConfiguracionEmpresas, { type EmpresaConfig } from '@/app/institucional/configuracion/ConfiguracionEmpresas'

export const dynamic = 'force-dynamic'

export default async function AdminConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ empresaIds?: string; mes?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()
  const empresas = await cargarEmpresasAVI(admin)
  const selectedIds = resolverSeleccion(empresas, params.empresaIds).filter(id => id !== SIN_EMPRESA)

  const { data } = selectedIds.length
    ? await admin.from('convenio_empresas').select('id, nombre, terminologia, telefono, telefono_solicitudes, logo_url')
        .in('id', selectedIds).order('nombre')
    : { data: [] }

  return (
    <div className="space-y-8">
      <EncabezadoAVI actual="/admin/institucional/configuracion" empresas={empresas} selectedIds={selectedIds} mes={params.mes} />
      {selectedIds.length === 0
        ? <p className="text-sm text-gray-400 text-center py-8">Selecciona una o más empresas.</p>
        : <ConfiguracionEmpresas empresas={(data ?? []) as EmpresaConfig[]} />}
    </div>
  )
}
