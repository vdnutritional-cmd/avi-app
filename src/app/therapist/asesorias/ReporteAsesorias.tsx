'use client'

import { useState } from 'react'
import { useTerminologiaMenu, useTerminologiaMenuValor } from '../TerminologiaMenu'
import { buildReportHeader, printHtmlViaIframe } from '@/app/therapist/patients/[patientId]/print-utils'
import { nombreAvi, type Terminologia } from '@/lib/terminologia'

type Palabras = ReturnType<typeof useTerminologiaMenu>

type Entry = { nombre: string; fecha: string }
type Empresa = { id: string; nombre: string; logo_url: string | null }

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
  w,
}: {
  titulo: string
  color: string
  entries: Entry[]
  w: Palabras
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
              <th className="px-5 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">{w.User}</th>
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

// PDF con el mismo encabezado, CSS base e impresión por iframe que los demás reportes
function imprimirReporte(data: ReporteData, w: Palabras, terminologia: Terminologia, logoUrl: string | null) {
  const formatFechaCorta = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  const filas = (entries: Entry[]) =>
    entries.map((e, i) => `
      <tr>
        <td style="padding:4px 10px; color:#999; text-align:right; width:28px;">${i + 1}</td>
        <td style="padding:4px 10px; text-transform:capitalize;">${formatFecha(e.fecha)}</td>
        <td style="padding:4px 10px;">${e.nombre}</td>
      </tr>
    `).join('')

  const bloque = (titulo: string, entries: Entry[]) =>
    entries.length === 0 ? '' : `
      <h2>${titulo} — ${entries.length}</h2>
      <table>
        <thead><tr><th style="text-align:right;width:28px;">#</th><th>Fecha</th><th>${w.User}</th></tr></thead>
        <tbody>${filas(entries)}</tbody>
      </table>
    `

  const total = data.presencialesFacturables.length + data.virtualesFacturables.length + data.proBono.length
  const totalFacturables = data.presencialesFacturables.length + data.virtualesFacturables.length

  const header = buildReportHeader({
    terapeutaNombre: data.terapeutaNombre,
    terminologia,
    logoUrl,
    side: logoUrl ? 'logo' : 'name',
    subtitle: `Reporte de ${w.Servs} · ${formatFechaCorta(data.desde)} — ${formatFechaCorta(data.hasta)}`,
  })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Reporte de ${w.Servs} — ${data.terapeutaNombre}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: letter; margin: 1cm 1.8cm 1.2cm; }
    html, body { margin: 0 !important; padding: 0 !important; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; line-height: 1.3; }
    h2 { font-size: 10.5pt; font-weight: 700; color: #2d3a8c; margin: 14px 0 6px; border-bottom: 1.5px solid #dde3ee; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5pt; }
    th { background: #f5f5f5; padding: 5px 10px; text-align: left; font-weight: 600; color: #555; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
    td { border-bottom: 1px solid #f0f0f0; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 8px; }
    .kpi { background: #eef1f9; border: 1px solid #dde3ee; border-radius: 6px; padding: 10px 14px; }
    .kpi-label { font-size: 8.5pt; color: #5060a4; margin-bottom: 2px; }
    .kpi-value { font-size: 18pt; font-weight: 700; color: #2d3a8c; }
    .footer { border-top: 0.5pt solid #dde3ee; margin-top: 14px; padding-top: 3pt; text-align: center; font-size: 6.5pt; color: #aaa; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>

  ${header}

  <h2>Resumen del periodo</h2>
  <div class="grid3">
    <div class="kpi"><div class="kpi-label">Total</div><div class="kpi-value">${total}</div></div>
    <div class="kpi"><div class="kpi-label">Facturables</div><div class="kpi-value">${totalFacturables}</div></div>
    <div class="kpi"><div class="kpi-label">Pro-Bono</div><div class="kpi-value">${data.proBono.length}</div></div>
  </div>

  ${bloque('Presenciales Facturables', data.presencialesFacturables)}
  ${bloque('Virtuales Facturables', data.virtualesFacturables)}
  ${bloque('Pro-Bono', data.proBono)}

  <div class="footer">${nombreAvi(terminologia)} · avi-app.com.mx</div>

</body>
</html>`

  printHtmlViaIframe(html)
}

export default function ReporteAsesorias() {
  const w = useTerminologiaMenu()
  const terminologia = useTerminologiaMenuValor()
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'

  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [data, setData]     = useState<ReporteData | null>(null)
  const [logos, setLogos]   = useState<Empresa[] | null>(null)   // modal: más de una empresa con logo

  // Igual que Mi estadística: con más de un logo se elige con cuál imprimir
  async function imprimir() {
    if (!data) return
    let empresas: Empresa[] = []
    try {
      const r = await fetch('/api/therapist/reportes-init')
      if (r.ok) empresas = ((await r.json()).empresas ?? []) as Empresa[]
    } catch { /* sin logo */ }
    const conLogo = empresas.filter(e => e.logo_url)
    if (conLogo.length > 1) setLogos(conLogo)
    else imprimirReporte(data, w, terminologia, conLogo[0]?.logo_url ?? null)
  }

  function imprimirCon(logoUrl: string | null) {
    setLogos(null)
    if (data) imprimirReporte(data, w, terminologia, logoUrl)
  }

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
      <p className="text-sm text-gray-500 mb-5">Detalle de {w.users} atendidos en un intervalo de fechas, separado por tipo.</p>

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
            onClick={imprimir}
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
            w={w}
          />
          <Bloque
            titulo="Virtuales Facturables"
            color="bg-blue-100 text-blue-700"
            entries={data.virtualesFacturables}
            w={w}
          />
          <Bloque
            titulo="Pro-Bono"
            color="bg-yellow-100 text-yellow-700"
            entries={data.proBono}
            w={w}
          />

          {total === 0 && (
            <p className="text-center text-gray-400 py-8">No hay {w.servs} registradas en este período.</p>
          )}
        </>
      )}

      {/* Modal de selección de logo (como en Mi estadística) */}
      {logos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 max-w-[90vw]">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">¿Con qué logo deseas imprimir?</h3>
            <p className="text-xs text-gray-500 mb-4">Perteneces a más de una empresa CONVENIO.</p>
            <div className="flex flex-col gap-2">
              {logos.map(e => (
                <button
                  key={e.id}
                  onClick={() => imprimirCon(e.logo_url)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.logo_url!} alt={e.nombre} className="h-8 w-20 object-contain shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{e.nombre}</span>
                </button>
              ))}
              <button
                onClick={() => imprimirCon(null)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-left"
              >
                <div className="h-8 w-20 shrink-0 flex items-center justify-center bg-gray-100 rounded text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Sin logo (nombre del {w.pro})</span>
              </button>
            </div>
            <button
              onClick={() => setLogos(null)}
              className="mt-4 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
