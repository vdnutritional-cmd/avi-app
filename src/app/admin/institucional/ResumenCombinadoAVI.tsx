// Administración Institucional AVI — bloques extra del Panel (solo superadmin),
// debajo de la vista idéntica a la de las Personas Institucionales:
//   - Por empresa: terapeutas y pacientes activos, con fila Total
//   - Terapeutas una sola vez, con sus pacientes de todas las empresas combinados
//     (+ "Sin empresa" si en el selector está marcada esa opción)
import type { EmpresaBlock } from '@/app/institucional/dashboard/PanelInstitucionalVista'
import type { TerapeutaIndependientes } from './empresas-avi'
import TerapeutasSinRepetirTabla, { type TerapeutaCombinado } from './TerapeutasSinRepetirTabla'

const SIN_EMPRESA_LABEL = 'Sin empresa'

export default function ResumenCombinadoAVI({ empresaBlocks, independientes, telefonos }: {
  empresaBlocks: EmpresaBlock[]
  /** null = "Sin empresa" no está seleccionado */
  independientes: TerapeutaIndependientes[] | null
  telefonos: Map<string, string>
}) {
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
  const conEmpresa = [...combinados.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))

  // "Sin empresa": se suman a los terapeutas de la lista; los que no están en
  // ninguna empresa seleccionada van al final, también en orden alfabético
  const soloSinEmpresa: TerapeutaCombinado[] = []
  for (const ind of independientes ?? []) {
    const pacientes = ind.pacientes.map(p => ({ ...p, empresa: SIN_EMPRESA_LABEL }))
    const c = combinados.get(ind.therapistId)
    if (c) {
      c.empresas.push(SIN_EMPRESA_LABEL)
      c.pacientes.push(...pacientes)
    } else {
      soloSinEmpresa.push({
        therapistId: ind.therapistId, nombre: ind.nombre, email: ind.email,
        telefono: telefonos.get(ind.therapistId) ?? '',
        empresas: [SIN_EMPRESA_LABEL], empresasHuerfano: [], pacientes,
      })
    }
  }
  soloSinEmpresa.sort((a, b) => a.nombre.localeCompare(b.nombre))
  const terapeutas = [...conEmpresa, ...soloSinEmpresa]

  // Pacientes: por empresa ("Sin empresa" al final) y nombre
  const ordenEmpresa = (e: string) => (e === SIN_EMPRESA_LABEL ? '\uffff' : e)
  for (const t of terapeutas) {
    t.pacientes.sort((a, b) => ordenEmpresa(a.empresa).localeCompare(ordenEmpresa(b.empresa)) || a.nombre.localeCompare(b.nombre))
  }

  const totalPacientes = bloques.reduce((n, b) => n + b.terapeutas.reduce((m, t) => m + t.pacientesActivos, 0), 0)
  const sumaTerapeutasPorEmpresa = bloques.reduce((n, b) => n + b.terapeutas.length, 0)
  const terapeutasConEmpresa = conEmpresa.length

  return (
    <div className="space-y-8">
      {/* Por empresa (solo con varias) */}
      {bloques.length > 1 && (
        <section className="space-y-2">
          <h2 className="pl-5 text-sm">
            {/* pl-5: a la altura del título "Terapeutas por Empresa" (px-5 del acordeón) */}
            <span className="font-bold text-gray-900 uppercase tracking-wide">Resumen por empresa</span>{' '}
            <span className="font-normal text-gray-400">(solo Administración AVI)</span>
          </h2>
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
                  <td className="px-3 py-2 text-center">{terapeutasConEmpresa}</td>
                  <td className="px-3 py-2 text-center">{totalPacientes}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {sumaTerapeutasPorEmpresa > terapeutasConEmpresa && (
            <p className="text-xs text-gray-400">
              El total de terapeutas ({terapeutasConEmpresa}) cuenta a cada terapeuta una sola vez; la suma por empresa
              ({sumaTerapeutasPorEmpresa}) es mayor porque hay terapeutas en más de una empresa.
            </p>
          )}
        </section>
      )}

      {/* Terapeutas: una vez cada uno, empresas en una columna, pacientes combinados */}
      <TerapeutasSinRepetirTabla terapeutas={terapeutas} />

    </div>
  )
}
