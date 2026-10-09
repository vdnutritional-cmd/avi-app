// Tabla "Control de Planes y Contrataciones" del Panel de Control (admin).
// Server component: los acordeones usan <details>, sin JavaScript.

export interface ControlPaciente {
  id: string
  nombre: string
  /** Texto gris a la derecha (empresa, fecha de registro, "Bloqueado") */
  detalle?: string
  bloqueado?: boolean
}

export interface ControlFila {
  therapistId: string
  nombre: string
  email: string
  desactivado: boolean
  plan: { texto: string; sub: string; color: 'green' | 'blue' | 'purple' | 'gray' | 'red' }
  convenio: ControlPaciente[]
  sinConvenio: ControlPaciente[]
  bloqueados: ControlPaciente[]
}

const PLAN_COLORS = {
  green:  'bg-green-100 text-green-700',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  gray:   'bg-gray-100 text-gray-500',
  red:    'bg-red-100 text-red-700',
}

function AcordeonPacientes({ pacientes, color }: { pacientes: ControlPaciente[]; color: 'primary' | 'green' | 'red' }) {
  if (pacientes.length === 0) return <span className="text-sm font-semibold text-primary-600">0</span>
  const badge = {
    primary: 'bg-primary-50 text-primary-700',
    green:   'bg-green-50 text-green-700',
    red:     'bg-red-50 text-red-600',
  }[color]
  return (
    <details className="group inline-block text-left">
      <summary className={`inline-flex items-center gap-1 cursor-pointer list-none text-xs font-semibold px-2.5 py-1 rounded-full ${badge}`}>
        {pacientes.length}
        <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <ul className="mt-2 space-y-1 min-w-[180px]">
        {pacientes.map(p => (
          <li key={p.id} className="text-xs text-gray-700 leading-snug">
            {p.nombre}
            {p.detalle && (
              <span className={`ml-1 ${p.bloqueado ? 'text-red-500 font-medium' : 'text-gray-400'}`}>· {p.detalle}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

export default function ControlPlanesTabla({ filas, nombreMes }: { filas: ControlFila[]; nombreMes: string }) {
  const totConvenio    = filas.reduce((n, f) => n + f.convenio.length, 0)
  const totSinConvenio = filas.reduce((n, f) => n + f.sinConvenio.length, 0)
  const totBloqueados  = filas.reduce((n, f) => n + f.bloqueados.length, 0)

  return (
    <section>
      <h2 className="text-base font-semibold text-primary-700 mb-1">Control de Planes y Contrataciones</h2>
      <p className="text-xs text-gray-400 mb-4">
        Todos los terapeutas registrados en AVI. Pacientes sin convenio = activos con acceso + bloqueados de {nombreMes}.
        Bloqueados = registrados en {nombreMes} que hoy siguen sin acceso por ser sin convenio y no tener cupo
        en el plan del terapeuta (o no tener plan). No se cuentan los bloqueados por inactividad ni los
        bloqueados manualmente por el terapeuta. Toca un número para ver los nombres.
      </p>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 align-bottom">
              <th className="text-left font-semibold px-4 py-3">Terapeuta</th>
              <th className="text-center font-semibold px-3 py-3">Pacientes en Convenio</th>
              <th className="text-left font-semibold px-3 py-3 min-w-[190px]">Plan contratado</th>
              <th className="text-center font-semibold px-3 py-3">Pacientes sin Convenio registrados</th>
              <th className="text-center font-semibold px-3 py-3">Pacientes Bloqueados</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.therapistId} className="border-t border-gray-100 align-top">
                <td className="px-4 py-1.5">
                  <p className="font-medium text-gray-800">
                    {f.nombre}
                    {f.desactivado && (
                      <span className="ml-2 text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">DESACTIVADO</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{f.email}</p>
                </td>
                <td className="px-3 py-1.5 text-center">
                  <AcordeonPacientes pacientes={f.convenio} color="primary" />
                </td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${PLAN_COLORS[f.plan.color]}`}>
                    {f.plan.texto}
                  </span>
                  {f.plan.sub && <p className="text-[11px] text-gray-400 mt-1 whitespace-nowrap">{f.plan.sub}</p>}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <AcordeonPacientes pacientes={f.sinConvenio} color="green" />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <AcordeonPacientes pacientes={f.bloqueados} color="red" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-primary-700">
              <td className="px-4 py-3">Total ({filas.length} terapeutas)</td>
              <td className="px-3 py-3 text-center">{totConvenio}</td>
              <td className="px-3 py-3" />
              <td className="px-3 py-3 text-center">{totSinConvenio}</td>
              <td className={`px-3 py-3 text-center ${totBloqueados > 0 ? 'text-red-600' : ''}`}>{totBloqueados}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
