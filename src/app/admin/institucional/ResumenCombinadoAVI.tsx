// Administración Institucional AVI — bloques extra del Panel (solo superadmin),
// debajo de la vista idéntica a la de las Personas Institucionales:
//   - Por empresa: terapeutas y pacientes activos, con fila Total
//   - Terapeutas una sola vez, con sus pacientes de todas las empresas combinados
import type { EmpresaBlock } from '@/app/institucional/dashboard/PanelInstitucionalVista'

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

export default function ResumenCombinadoAVI({ empresaBlocks }: { empresaBlocks: EmpresaBlock[] }) {
  const bloques = empresaBlocks

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

  return (
    <div className="space-y-8">
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
            Terapeutas sin repetir <span className="text-gray-400 font-normal">({terapeutas.length}) · pacientes de todas sus empresas</span>
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

    </div>
  )
}
