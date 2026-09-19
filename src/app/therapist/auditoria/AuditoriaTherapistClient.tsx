'use client'

import { useState, useMemo } from 'react'

export type AuditRow = {
  id: string
  usuario_id: string
  operacion: string
  tabla: string
  registro_id: string | null
  datos_antes: Record<string, unknown> | null
  datos_despues: Record<string, unknown> | null
  created_at: string
}

interface Props {
  logs: AuditRow[]
  pacientes: Record<string, string>   // patientId → nombre
}

const TABLA_LABEL: Record<string, string> = {
  patient_expediente:     'Expediente clínico',
  therapist_session_notes: 'Sesiones presenciales',
  analyses:               'Análisis Consúltame',
  patient_questionnaires: 'Cuestionarios',
}

const OP_LABEL: Record<string, { label: string; cls: string }> = {
  INSERT: { label: 'Creación',     cls: 'bg-green-100 text-green-700' },
  UPDATE: { label: 'Modificación', cls: 'bg-blue-100 text-blue-700'  },
  DELETE: { label: 'Eliminación',  cls: 'bg-red-100 text-red-700'    },
}

export default function AuditoriaTherapistClient({ logs, pacientes }: Props) {
  const [filtroOp,    setFiltroOp]    = useState('')
  const [filtroTabla, setFiltroTabla] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const tablas     = useMemo(() => [...new Set(logs.map(l => l.tabla))].sort(), [logs])
  const operaciones = useMemo(() => [...new Set(logs.map(l => l.operacion))].sort(), [logs])

  const filtrados = useMemo(() => logs.filter(l => {
    if (filtroOp    && l.operacion !== filtroOp)    return false
    if (filtroTabla && l.tabla     !== filtroTabla) return false
    if (filtroDesde) {
      const d = new Date(filtroDesde); d.setHours(0, 0, 0, 0)
      if (new Date(l.created_at) < d) return false
    }
    if (filtroHasta) {
      const h = new Date(filtroHasta); h.setHours(23, 59, 59, 999)
      if (new Date(l.created_at) > h) return false
    }
    return true
  }), [logs, filtroOp, filtroTabla, filtroDesde, filtroHasta])

  function exportarCSV() {
    const headers = ['Fecha', 'Paciente', 'Operación', 'Recurso', 'Registro ID', 'Datos antes', 'Datos después']
    const rows = filtrados.map(l => {
      const pid = (l.datos_despues?.patient_id ?? l.datos_antes?.patient_id ?? '') as string
      return [
        new Date(l.created_at).toLocaleString('es-MX'),
        pacientes[pid] ?? pid,
        l.operacion,
        TABLA_LABEL[l.tabla] ?? l.tabla,
        l.registro_id ?? '',
        l.datos_antes   ? JSON.stringify(l.datos_antes)   : '',
        l.datos_despues ? JSON.stringify(l.datos_despues) : '',
      ]
    })
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `auditoria_pacientes_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditorías información pacientes</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Historial de cambios clínicos de tus pacientes registrado automáticamente (NOM-024-SSA3-2012).
            Los registros están disponibles a partir del inicio del sistema de auditoría.
          </p>
        </div>
        <button
          onClick={exportarCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          ↓ Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Operación</label>
          <select
            value={filtroOp}
            onChange={e => setFiltroOp(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">Todas</option>
            {operaciones.map(o => (
              <option key={o} value={o}>{OP_LABEL[o]?.label ?? o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Recurso</label>
          <select
            value={filtroTabla}
            onChange={e => setFiltroTabla(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">Todos</option>
            {tablas.map(t => (
              <option key={t} value={t}>{TABLA_LABEL[t] ?? t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Fecha inicio</label>
          <input
            type="date"
            value={filtroDesde}
            onChange={e => setFiltroDesde(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Fecha fin</label>
          <input
            type="date"
            value={filtroHasta}
            onChange={e => setFiltroHasta(e.target.value)}
            min={filtroDesde}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Mostrando <span className="font-semibold text-gray-800">{filtrados.length}</span> de {logs.length} registros
      </p>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Paciente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Operación</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Recurso</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    No hay registros que coincidan con los filtros.
                  </td>
                </tr>
              ) : filtrados.map(log => {
                const pid = (log.datos_despues?.patient_id ?? log.datos_antes?.patient_id ?? '') as string
                const op  = OP_LABEL[log.operacion]
                return (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(log.created_at).toLocaleString('es-MX')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-[180px]">
                        {pacientes[pid] ?? <span className="text-gray-400 italic">Desconocido</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${op?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                        {op?.label ?? log.operacion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {TABLA_LABEL[log.tabla] ?? log.tabla}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {(log.datos_antes || log.datos_despues) ? (
                        <details>
                          <summary className="cursor-pointer text-primary-600 hover:underline">Ver</summary>
                          <pre className="mt-1 text-xs bg-gray-50 rounded p-2 max-w-xs overflow-auto">
                            {JSON.stringify({ antes: log.datos_antes, despues: log.datos_despues }, null, 2)}
                          </pre>
                        </details>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
