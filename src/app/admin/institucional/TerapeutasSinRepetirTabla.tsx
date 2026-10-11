'use client'

import { Fragment, useState } from 'react'

// Administración Institucional AVI — "Terapeutas registrados": cada terapeuta una
// vez, con sus empresas una debajo de otra (+ "Sin empresa" si tiene pacientes
// independientes) y, al abrir la fila, sus pacientes activos (paciente | empresa).

export interface TerapeutaCombinado {
  therapistId: string
  nombre: string
  email: string
  telefono: string
  empresas: string[]
  /** Empresas donde ya no está en therapist_empresa pero conserva pacientes activos */
  empresasHuerfano: string[]
  pacientes: { id: string; nombre: string; empresa: string }[]
}

export default function TerapeutasSinRepetirTabla({ terapeutas }: { terapeutas: TerapeutaCombinado[] }) {
  const [open, setOpen] = useState(false)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setAbiertos(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const huerfanos = terapeutas.filter(t => t.empresasHuerfano.length > 0).length

  return (
    <div className="bg-white border border-primary-100 rounded-2xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <h3 className="font-semibold text-primary-700 text-sm flex items-center gap-2 flex-wrap text-left">
          Terapeutas registrados
          <span className="text-primary-400 font-normal">({terapeutas.length}) · pacientes de todas sus actividades</span>
          <span className="text-gray-400 font-normal">(solo Administración AVI)</span>
          {huerfanos > 0 && (
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
              ⚠️ {huerfanos} requiere{huerfanos > 1 ? 'n' : ''} atención
            </span>
          )}
        </h3>
        <svg className={`w-4 h-4 text-primary-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        terapeutas.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center border-t border-gray-50">No hay terapeutas registrados.</p>
        ) : (
          <div className="overflow-x-auto border-t border-gray-50">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="w-6" />
                  <th className="text-left px-3 py-3">Terapeuta</th>
                  <th className="text-left px-3 py-3">Empresa(s)</th>
                  <th className="text-left px-3 py-3 hidden sm:table-cell">Teléfono</th>
                  <th className="text-left px-3 py-3 hidden lg:table-cell">Correo</th>
                  <th className="text-right px-5 py-3">Pac. activos</th>
                </tr>
              </thead>
              <tbody>
                {terapeutas.map(t => {
                  const abierto = abiertos.has(t.therapistId)
                  const tieneDetalle = t.pacientes.length > 0
                  return (
                    <Fragment key={t.therapistId}>
                      <tr
                        onClick={() => tieneDetalle && toggle(t.therapistId)}
                        className={`border-t border-gray-50 align-top ${tieneDetalle ? 'cursor-pointer hover:bg-gray-50' : ''} ${abierto ? 'bg-gray-50' : ''}`}
                      >
                        <td className="pl-3 pr-1 py-3.5 text-gray-400">
                          {tieneDetalle && (
                            <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${abierto ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="font-medium text-gray-800">{t.nombre}</span>
                          {t.empresasHuerfano.length > 0 && (
                            <span className="block mt-1 w-fit bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                              ⚠️ Sin empresa activa en {t.empresasHuerfano.join(', ')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-gray-500">
                          {t.empresas.map(e => <span key={e} className="block leading-snug">{e}</span>)}
                        </td>
                        <td className="px-3 py-3.5 text-gray-500 hidden sm:table-cell">{t.telefono || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-3.5 text-gray-500 hidden lg:table-cell">{t.email}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm bg-primary-50 text-primary-700">
                            {t.pacientes.length}
                          </span>
                        </td>
                      </tr>
                      {abierto && (
                        <tr className="bg-gray-50 border-t border-gray-100">
                          <td colSpan={6} className="px-8 pb-4 pt-2">
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
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
