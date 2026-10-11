// Administración Institucional AVI — bloques extra del Panel (solo superadmin),
// debajo de la vista idéntica a la de las Personas Institucionales:
//   - Por empresa: terapeutas y pacientes activos, con fila Total
//   - Terapeutas una sola vez, con sus pacientes de todas las empresas combinados
import type { EmpresaBlock } from '@/app/institucional/dashboard/PanelInstitucionalVista'
import TerapeutasSinRepetirTabla, { type TerapeutaCombinado } from './TerapeutasSinRepetirTabla'

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

      {/* Terapeutas: una vez cada uno, empresas en una columna, pacientes combinados */}
      <TerapeutasSinRepetirTabla terapeutas={terapeutas} />

    </div>
  )
}
