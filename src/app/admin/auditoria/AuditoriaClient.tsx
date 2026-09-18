'use client'

import { useState, useMemo } from 'react'

type AuditRow = {
  id: string
  usuario_id: string
  operacion: string
  tabla: string
  registro_id: string | null
  datos_antes: Record<string, unknown> | null
  datos_despues: Record<string, unknown> | null
  created_at: string
  profiles: { email: string; role: string } | null
}

export default function AuditoriaClient({ logs }: { logs: AuditRow[] }) {
  const [filtroOp, setFiltroOp]           = useState('')
  const [filtroTabla, setFiltroTabla]     = useState('')
  const [filtroEmail, setFiltroEmail]     = useState('')
  const [filtroDesde, setFiltroDesde]     = useState('')
  const [filtroHasta, setFiltroHasta]     = useState('')

  const operaciones = useMemo(() => [...new Set(logs.map(l => l.operacion))].sort(), [logs])
  const tablas      = useMemo(() => [...new Set(logs.map(l => l.tabla))].sort(), [logs])

  const filtrados = useMemo(() => logs.filter(l => {
    if (filtroOp    && l.operacion !== filtroOp)   return false
    if (filtroTabla && l.tabla     !== filtroTabla) return false
    if (filtroEmail && !l.profiles?.email?.toLowerCase().includes(filtroEmail.toLowerCase())) return false
    if (filtroDesde) {
      const desde = new Date(filtroDesde)
      desde.setHours(0, 0, 0, 0)
      if (new Date(l.created_at) < desde) return false
    }
    if (filtroHasta) {
      const hasta = new Date(filtroHasta)
      hasta.setHours(23, 59, 59, 999)
      if (new Date(l.created_at) > hasta) return false
    }
    return true
  }), [logs, filtroOp, filtroTabla, filtroEmail, filtroDesde, filtroHasta])

  function exportarCSV() {
    const headers = ['Fecha', 'Usuario', 'Rol', 'Operación', 'Tabla', 'Registro ID', 'Datos antes', 'Datos después']
    const rows = filtrados.map(l => [
      new Date(l.created_at).toLocaleString('es-MX'),
      l.profiles?.email ?? l.usuario_id,
      l.profiles?.role ?? '',
      l.operacion,
      l.tabla,
      l.registro_id ?? '',
      l.datos_antes   ? JSON.stringify(l.datos_antes)   : '',
      l.datos_despues ? JSON.stringify(l.datos_despues) : '',
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `auditoria_avi_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Auditoría de accesos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Registro de acciones clínicas en la plataforma (NOM-024)
          </p>
        </div>
        <button
          onClick={exportarCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition"
        >
          ↓ Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Operación</label>
          <select
            value={filtroOp}
            onChange={e => setFiltroOp(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">Todas</option>
            {operaciones.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Tabla / Recurso</label>
          <select
            value={filtroTabla}
            onChange={e => setFiltroTabla(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">Todas</option>
            {tablas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Usuario (email)</label>
          <input
            type="text"
            placeholder="Buscar..."
            value={filtroEmail}
            onChange={e => setFiltroEmail(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Usuario</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Operación</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tabla</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Registro ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No hay registros que coincidan con los filtros.
                  </td>
                </tr>
              ) : filtrados.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(log.created_at).toLocaleString('es-MX')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 truncate max-w-[180px]">
                      {log.profiles?.email ?? log.usuario_id}
                    </p>
                    {log.profiles?.role && (
                      <span className="text-xs text-gray-400">{log.profiles.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      log.operacion === 'DELETE'                 ? 'bg-red-100 text-red-700' :
                      log.operacion === 'INSERT'                 ? 'bg-green-100 text-green-700' :
                      log.operacion === 'UPDATE'                 ? 'bg-blue-100 text-blue-700' :
                      log.operacion.startsWith('API:')            ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {log.operacion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{log.tabla}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[120px]">
                    {log.registro_id ?? '—'}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
