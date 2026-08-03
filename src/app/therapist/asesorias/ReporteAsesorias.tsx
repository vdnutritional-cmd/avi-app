'use client'

import { useState } from 'react'

type Entry = { nombre: string; fecha: string }

interface ReporteData {
  terapeutaNombre: string
  desde: string
  hasta: string
  presencialesFacturables: Entry[]
  virtualesFacturables: Entry[]
  proBono: Entry[]
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function Bloque({
  titulo,
  color,
  entries,
}: {
  titulo: string
  color: string
  entries: Entry[]
}) {
  if (entries.length === 0) return null
  return (
    <div className="mb-6">
      <div className={`inline-block text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full mb-3 ${color}`}>
        {titulo} — {entries.length}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide w-8">#</th>
              <th className="px-5 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Fecha</th>
              <th className="px-5 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Asesorado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {entries.map((e, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-3 text-gray-400 text-xs font-semibold w-8 text-right">{i + 1}</td>
                <td className="px-5 py-3 text-gray-500 whitespace-nowrap capitalize">{formatFecha(e.fecha)}</td>
                <td className="px-5 py-3 text-gray-800 font-medium">{e.nombre}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function imprimirReporte(data: ReporteData) {
  const formatFechaCorta = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  const filas = (entries: Entry[]) =>
    entries.map((e, i) => `
      <tr>
        <td style="padding:8px 10px; color:#aaa; font-size:11px; font-weight:600; text-align:right; width:28px;">${i + 1}</td>
        <td style="padding:8px 12px; color:#555; text-transform:capitalize;">${formatFecha(e.fecha)}</td>
        <td style="padding:8px 12px; font-weight:500; color:#222;">${e.nombre}</td>
      </tr>
    `).join('')

  const bloque = (titulo: string, color: string, entries: Entry[]) =>
    entries.length === 0 ? '' : `
      <div style="margin-bottom:28px;">
        <div style="display:inline-block; font-size:11px; font-weight:700; text-transform:uppercase;
                    letter-spacing:.06em; padding:4px 12px; border-radius:999px; margin-bottom:10px;
                    background:${color === 'green' ? '#d1fae5' : color === 'blue' ? '#dbeafe' : '#fde68a'};
                    color:${color === 'green' ? '#065f46' : color === 'blue' ? '#1e40af' : '#92400e'};">
          ${titulo} — ${entries.length}
        </div>
        <table width="100%" style="border-collapse:collapse; font-size:13px; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 10px; text-align:right; font-size:11px; color:#9ca3af; width:28px;">#</th>
              <th style="padding:8px 12px; text-align:left; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:.05em;">Fecha</th>
              <th style="padding:8px 12px; text-align:left; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:.05em;">Asesorado</th>
            </tr>
          </thead>
          <tbody>
            ${filas(entries)}
          </tbody>
        </table>
      </div>
    `

  const total = data.presencialesFacturables.length + data.virtualesFacturables.length + data.proBono.length
  const totalFacturables = data.presencialesFacturables.length + data.virtualesFacturables.length

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Asesorías — ${data.terapeutaNombre}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #fff; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; }
    @media print {
      body { padding: 20px; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Encabezado -->
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:2px solid #7c3aed;">
    <div>
      <div style="font-size:22px; font-weight:700; color:#7c3aed; letter-spacing:-.01em;">AVI</div>
      <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Asesoría Virtual Interactiva</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:14px; font-weight:600; color:#374151;">Reporte de Asesorías</div>
      <div style="font-size:13px; color:#6b7280; margin-top:2px;">${data.terapeutaNombre}</div>
      <div style="font-size:12px; color:#9ca3af; margin-top:4px;">
        ${formatFechaCorta(data.desde)} — ${formatFechaCorta(data.hasta)}
      </div>
    </div>
  </div>

  <!-- Resumen -->
  <div style="display:flex; gap:16px; margin-bottom:32px;">
    <div style="flex:1; background:#f5f3ff; border-radius:12px; padding:14px 18px; text-align:center;">
      <div style="font-size:24px; font-weight:700; color:#7c3aed;">${total}</div>
      <div style="font-size:11px; color:#6d28d9; text-transform:uppercase; letter-spacing:.05em; margin-top:2px;">Total</div>
    </div>
    <div style="flex:1; background:#d1fae5; border-radius:12px; padding:14px 18px; text-align:center;">
      <div style="font-size:24px; font-weight:700; color:#059669;">${totalFacturables}</div>
      <div style="font-size:11px; color:#065f46; text-transform:uppercase; letter-spacing:.05em; margin-top:2px;">Facturables</div>
    </div>
    <div style="flex:1; background:#fef3c7; border-radius:12px; padding:14px 18px; text-align:center;">
      <div style="font-size:24px; font-weight:700; color:#d97706;">${data.proBono.length}</div>
      <div style="font-size:11px; color:#92400e; text-transform:uppercase; letter-spacing:.05em; margin-top:2px;">Pro-Bono</div>
    </div>
  </div>

  <!-- Bloques -->
  ${bloque('Presenciales Facturables', 'green', data.presencialesFacturables)}
  ${bloque('Virtuales Facturables', 'blue', data.virtualesFacturables)}
  ${bloque('Pro-Bono', 'amber', data.proBono)}

  <!-- Pie -->
  <div style="margin-top:40px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; display:flex; justify-content:space-between;">
    <span>AVI — Asesoría Virtual Interactiva</span>
    <span>Generado el ${new Date().toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' })}</span>
  </div>

  <div style="text-align:center; margin-top:24px;">
    <button onclick="window.print()" style="background:#7c3aed; color:#fff; border:none; border-radius:8px; padding:10px 24px; font-size:14px; font-weight:600; cursor:pointer;">
      Imprimir / Guardar PDF
    </button>
  </div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

export default function ReporteAsesorias() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'

  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [data, setData]     = useState<ReporteData | null>(null)

  async function generar() {
    setLoading(true)
    setError('')
    setData(null)
    try {
      const res = await fetch(`/api/therapist/reporte-asesorias?desde=${desde}&hasta=${hasta}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar reporte')
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const totalFacturables = data
    ? data.presencialesFacturables.length + data.virtualesFacturables.length
    : 0
  const total = data
    ? totalFacturables + data.proBono.length
    : 0

  return (
    <div className="mt-10 border-t border-gray-100 pt-10">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Reporte por período</h2>
      <p className="text-sm text-gray-500 mb-5">Detalle de asesorados atendidos en un intervalo de fechas, separado por tipo.</p>

      {/* Selector de fechas */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-500 font-medium mb-1">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={e => setDesde(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 font-medium mb-1">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={e => setHasta(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <button
          onClick={generar}
          disabled={loading || !desde || !hasta}
          className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {loading ? 'Generando…' : 'Generar reporte'}
        </button>
        {data && (
          <button
            onClick={() => imprimirReporte(data)}
            className="px-5 py-2 border border-purple-300 text-purple-700 hover:bg-purple-50 rounded-lg text-sm font-semibold transition-colors"
          >
            🖨 Imprimir
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-4">{error}</p>
      )}

      {/* Resultados */}
      {data && (
        <>
          {/* Chips resumen */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-semibold">
              Total: {total}
            </span>
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
              Facturables: {totalFacturables}
            </span>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-semibold">
              Pro-Bono: {data.proBono.length}
            </span>
          </div>

          <Bloque
            titulo="Presenciales Facturables"
            color="bg-green-100 text-green-700"
            entries={data.presencialesFacturables}
          />
          <Bloque
            titulo="Virtuales Facturables"
            color="bg-blue-100 text-blue-700"
            entries={data.virtualesFacturables}
          />
          <Bloque
            titulo="Pro-Bono"
            color="bg-yellow-100 text-yellow-700"
            entries={data.proBono}
          />

          {total === 0 && (
            <p className="text-center text-gray-400 py-8">No hay asesorías registradas en este período.</p>
          )}
        </>
      )}
    </div>
  )
}
