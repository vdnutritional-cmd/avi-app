// SaaS Controller › AVI Administración › Alta/Baja de <Pros>
// La misma pantalla de las Personas Institucionales, para las empresas elegidas
// en el selector común. Acceso: superadmin (admin/layout.tsx).
import { createAdminClient } from '@/lib/supabase/admin'
import { terminos } from '@/lib/terminologia'
import EncabezadoAVI from '../EncabezadoAVI'
import { cargarEmpresasAVI, resolverSeleccion, SIN_EMPRESA, palabraDeEmpresas } from '../empresas-avi'
import { cargarAltaBaja } from '@/app/institucional/alta-baja/cargar-alta-baja'
import AltaBajaPros from '@/app/institucional/alta-baja/AltaBajaPros'

export const dynamic = 'force-dynamic'

export default async function AdminAltaBajaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresaIds?: string; mes?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()
  const empresas = await cargarEmpresasAVI(admin)
  const selectedIds = resolverSeleccion(empresas, params.empresaIds).filter(id => id !== SIN_EMPRESA)
  const seleccionadas = empresas.filter(e => selectedIds.includes(e.id))
  const pros = await cargarAltaBaja(admin, seleccionadas)

  return (
    <div className="space-y-8">
      <EncabezadoAVI actual="/admin/institucional/alta-baja" empresas={empresas} selectedIds={selectedIds} mes={params.mes} />
      {seleccionadas.length === 0
        ? <p className="text-sm text-gray-400 text-center py-8">Selecciona una o más empresas.</p>
        : <AltaBajaPros empresas={seleccionadas} pros={pros} w={terminos(palabraDeEmpresas(seleccionadas))} />}
    </div>
  )
}
