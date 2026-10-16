// Administración Institucional AVI › Panel Institucional
// Misma vista y mismos datos que el Panel Institucional de una Persona
// Institucional (PanelInstitucionalVista + cargar-panel.ts), como N1 de las
// empresas elegidas en el selector común: el Administrador AVI ve exactamente
// lo que ven ellas, para poder apoyarlas. Antes de los reportes agrega un
// resumen por empresa y la lista combinada de terapeutas (ResumenCombinadoAVI).
// Acceso: superadmin (admin/layout.tsx).
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import { cargarTelefonos, cargarTerapeutasEmpresa } from '@/app/institucional/dashboard/cargar-panel'
import PanelInstitucionalVista, { type EmpresaBlock } from '@/app/institucional/dashboard/PanelInstitucionalVista'
import EncabezadoAVI from './EncabezadoAVI'
import ResumenCombinadoAVI from './ResumenCombinadoAVI'
import { cargarEmpresasAVI, cargarIndependientes, palabraDeEmpresas, resolverSeleccion, SIN_EMPRESA } from './empresas-avi'

export const dynamic = 'force-dynamic'

export default async function AdminInstitucionalPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ empresaIds?: string; mes?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const empresas = await cargarEmpresasAVI(admin)
  const selectedIds = resolverSeleccion(empresas, params.empresaIds)
  const seleccionadas = empresas.filter(e => selectedIds.includes(e.id))
  if (user) logApiAccess(supabase, user.id, '/admin/institucional', 'GET', { empresa_ids: selectedIds })

  const conSinEmpresa = selectedIds.includes(SIN_EMPRESA)
  const [whatsappMap, independientes] = await Promise.all([
    seleccionadas.length > 0 || conSinEmpresa ? cargarTelefonos(admin) : Promise.resolve(new Map<string, string>()),
    conSinEmpresa ? cargarIndependientes(admin) : Promise.resolve(null),
  ])
  const empresaBlocks: EmpresaBlock[] = await Promise.all(
    seleccionadas.map(async e => ({
      empresaId: e.id,
      empresaNombre: e.nombre,
      empresaLogoUrl: e.logo_url,
      nivel: 'N1' as const,
      terminologia: e.terminologia,
      terapeutas: await cargarTerapeutasEmpresa(admin, e.id, e.nombre, whatsappMap),
    }))
  )

  const qs = new URLSearchParams({ empresaIds: selectedIds.join(',') })
  if (params.mes) qs.set('mes', params.mes)

  return (
    <div className="space-y-8">
      <EncabezadoAVI actual="/admin/institucional" empresas={empresas} selectedIds={selectedIds} mes={params.mes} />

      <div className="transition-opacity duration-150 [html[data-reporte-cargando]_&]:opacity-40 [html[data-reporte-cargando]_&]:pointer-events-none">
        {empresaBlocks.length === 0 && !conSinEmpresa ? (
          <p className="text-sm text-gray-400 text-center py-8">Selecciona una o más empresas.</p>
        ) : empresaBlocks.length === 0 ? (
          // Solo "Sin empresa": no hay Terapeutas por Empresa ni Resumen; solo la lista de terapeutas
          <ResumenCombinadoAVI empresaBlocks={[]} independientes={independientes} telefonos={whatsappMap} terminologia={palabraDeEmpresas(seleccionadas)} />
        ) : (
          <PanelInstitucionalVista
            empresaBlocks={empresaBlocks}
            permisos={{ reporteGeneral: true, reporteTerapeuta: true }}
            hrefReporteGeneral={`/admin/institucional/reporte-general?${qs.toString()}`}
            hrefReporteTerapeuta={`/admin/institucional/reporte-terapeuta?${qs.toString()}`}
            antesDeReportes={<ResumenCombinadoAVI empresaBlocks={empresaBlocks} independientes={independientes} telefonos={whatsappMap} terminologia={palabraDeEmpresas(seleccionadas)} />}
          />
        )}
      </div>
    </div>
  )
}
