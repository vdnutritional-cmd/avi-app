// Administración Institucional AVI › Panel Institucional
// Mismos datos que el Panel Institucional de una Persona Institucional N1
// (cargar-panel.ts), para las empresas elegidas en el selector común:
//   - Tarjetas: terapeutas sin repetir y pacientes activos sumados
//   - Tabla por empresa con fila Total
//   - Terapeutas una sola vez, con sus pacientes de todas las empresas combinados
// Acceso: superadmin (admin/layout.tsx).
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import { cargarTelefonos, cargarTerapeutasEmpresa, type TerapeutaRow } from '@/app/institucional/dashboard/cargar-panel'
import EncabezadoAVI from './EncabezadoAVI'
import { cargarEmpresasAVI, resolverSeleccion } from './empresas-avi'

export const dynamic = 'force-dynamic'

interface TerapeutaCombinado {
  therapistId: string
  nombre: string
  email: string
  telefono: string
  empresas: string[]
  /** Empresas donde ya no está en therapist_empresa pero conserva pacientes activos */
  empresasHuerfano: string[]
  pacientes: { id: string; nombre: string; empresa: string }[]
}

function TarjetaReporte({ titulo, descripcion, href }: { titulo: string; descripcion: string; href: string }) {
  return (
    <Link
      href={href}
      className="group bg-white border border-primary-100 rounded-2xl p-5 hover:border-primary-300 hover:shadow-sm transition-all block"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-700 text-sm group-hover:text-primary-700 transition-colors">{titulo}</h3>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{descripcion}</p>
        </div>
        <span className="shrink-0 text-primary-400 group-hover:text-primary-600 transition-colors text-lg mt-0.5">→</span>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-end">
        <span className="inline-flex items-center gap-1 text-sm font-bold text-white bg-primary-600 px-4 py-1.5 rounded-lg shadow-sm transition-colors group-hover:bg-primary-700">
          Ver reporte <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  )
}

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

  // Misma carga que el Panel Institucional de cada empresa
  const whatsappMap = seleccionadas.length > 0 ? await cargarTelefonos(admin) : new Map<string, string>()
  const bloques: { empresaId: string; empresaNombre: string; terapeutas: TerapeutaRow[] }[] = await Promise.all(
    seleccionadas.map(async e => ({
      empresaId: e.id,
      empresaNombre: e.nombre,
      terapeutas: await cargarTerapeutasEmpresa(admin, e.id, e.nombre, whatsappMap),
    }))
  )

  // Terapeutas sin repetir, con pacientes combinados (cada paciente con su empresa)
  const combinados = new Map<string, TerapeutaCombinado>()
  for (const b of bloques) {
    for (const t of b.terapeutas) {
      const c = combinados.get(t.therapistId) ?? {
        therapistId: t.therapistId, nombre: t.nombre, email: t.email, telefono: t.telefono,
        empresas: [], empresasHuerfano: [], pacientes: [],
      }
      c.empresas.push(b.empresaNombre)
      if (t.isHuerfano) c.empresasHuerfano.push(b.empresaNombre)
      c.pacientes.push(...t.pacientes.map(p => ({ ...p, empresa: b.empresaNombre })))
      combinados.set(t.therapistId, c)
    }
  }
  const terapeutas = [...combinados.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  for (const t of terapeutas) {
    t.pacientes.sort((a, b) => a.empresa.localeCompare(b.empresa) || a.nombre.localeCompare(b.nombre))
  }

  const totalPacientes = bloques.reduce((n, b) => n + b.terapeutas.reduce((m, t) => m + t.pacientesActivos, 0), 0)
  const sumaTerapeutasPorEmpresa = bloques.reduce((n, b) => n + b.terapeutas.length, 0)
  const huerfanos = terapeutas.filter(t => t.empresasHuerfano.length > 0).length

  const qs = new URLSearchParams({ empresaIds: selectedIds.join(',') })
  if (params.mes) qs.set('mes', params.mes)

  return (
    <div className="space-y-8">
      <EncabezadoAVI actual="/admin/institucional" empresas={empresas} selectedIds={selectedIds} mes={params.mes} />

      <div className="space-y-8 transition-opacity duration-150 [html[data-reporte-cargando]_&]:opacity-40 [html[data-reporte-cargando]_&]:pointer-events-none">
      {seleccionadas.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Selecciona una o más empresas.</p>
      ) : (
        <>
          {/* Tarjetas de resumen */}
          <div className="flex gap-6 md:w-2/3 md:mx-auto">
            <div className="flex-1 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex flex-col items-center justify-center gap-0.5">
              <span className="text-3xl font-bold text-green-700 leading-none">{terapeutas.length}</span>
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide mt-1">Terapeutas</span>
            </div>
            <div className="flex-1 bg-primary-50 border border-primary-200 rounded-2xl px-4 py-3 flex flex-col items-center justify-center gap-0.5">
              <span className="text-3xl font-bold text-primary-700 leading-none">{totalPacientes}</span>
              <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide mt-1">Pacientes activos</span>
            </div>
          </div>

          {/* Por empresa (solo con varias) */}
          {bloques.length > 1 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-primary-600 uppercase tracking-wide">Por empresa</h2>
              <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="text-left font-semibold px-5 py-3">Empresa</th>
                      <th className="text-center font-semibold px-3 py-3">Terapeutas</th>
                      <th className="text-center font-semibold px-3 py-3">Pacientes activos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bloques.map(b => (
                      <tr key={b.empresaId} className="border-t border-gray-100">
                        <td className="px-5 py-2 text-gray-800">{b.empresaNombre}</td>
                        <td className="px-3 py-2 text-center text-gray-700">{b.terapeutas.length}</td>
                        <td className="px-3 py-2 text-center text-gray-700">{b.terapeutas.reduce((n, t) => n + t.pacientesActivos, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-primary-700">
                      <td className="px-5 py-2">Total</td>
                      <td className="px-3 py-2 text-center">{terapeutas.length}</td>
                      <td className="px-3 py-2 text-center">{totalPacientes}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {sumaTerapeutasPorEmpresa > terapeutas.length && (
                <p className="text-xs text-gray-400">
                  El total de terapeutas ({terapeutas.length}) cuenta a cada terapeuta una sola vez; la suma por empresa
                  ({sumaTerapeutasPorEmpresa}) es mayor porque hay terapeutas en más de una empresa.
                </p>
              )}
            </section>
          )}

          {/* Terapeutas: una vez cada uno, pacientes combinados */}
          <details className="group bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none hover:bg-gray-50">
              <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                Terapeutas registrados <span className="text-gray-400 font-normal">({terapeutas.length})</span>
                {huerfanos > 0 && (
                  <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    ⚠️ {huerfanos} requiere{huerfanos > 1 ? 'n' : ''} atención
                  </span>
                )}
              </h3>
              <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-gray-50 divide-y divide-gray-50">
              {terapeutas.length === 0 && (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">No hay terapeutas registrados.</p>
              )}
              {terapeutas.map(t => (
                <details key={t.therapistId} className="group/t">
                  <summary className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 cursor-pointer list-none hover:bg-gray-50">
                    <span className="font-medium text-gray-800 text-sm">{t.nombre}</span>
                    <span className="text-xs text-gray-500">{t.empresas.join(' · ')}</span>
                    <span className="text-xs text-gray-400 hidden md:inline">{t.email}</span>
                    <span className="text-xs text-gray-400 hidden sm:inline">{t.telefono}</span>
                    {t.empresasHuerfano.length > 0 && (
                      <span className="inline-flex items-center bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                        ⚠️ Sin empresa activa en {t.empresasHuerfano.join(', ')}
                      </span>
                    )}
                    <span className="ml-auto inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm bg-primary-50 text-primary-700">
                      {t.pacientes.length}
                    </span>
                  </summary>
                  {t.pacientes.length > 0 && (
                    <div className="bg-gray-50 px-8 pb-4 pt-2">
                      <table className="w-full text-sm max-w-lg">
                        <thead>
                          <tr className="text-xs text-gray-400">
                            <th className="text-left font-medium pb-1 pr-4">Paciente activo</th>
                            <th className="text-left font-medium pb-1">Empresa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.pacientes.map(p => (
                            <tr key={`${p.empresa}-${p.id}`}>
                              <td className="py-0.5 pr-4 text-gray-700">{p.nombre}</td>
                              <td className="py-0.5 text-gray-500 whitespace-nowrap">{p.empresa}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </details>
              ))}
            </div>
          </details>

          {/* Reportes (nivel N1) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TarjetaReporte
              titulo="Reporte Institucional General"
              descripcion="Estadística agregada de todos los terapeutas de las empresas seleccionadas: sesiones, derivaciones y satisfacción."
              href={`/admin/institucional/reporte-general?${qs.toString()}`}
            />
            <TarjetaReporte
              titulo="Reporte por terapeuta"
              descripcion="Estadística de sesiones, motivos, derivaciones y satisfacción por terapeuta y empresa."
              href={`/admin/institucional/reporte-terapeuta?${qs.toString()}`}
            />
          </div>
        </>
      )}
      </div>
    </div>
  )
}
