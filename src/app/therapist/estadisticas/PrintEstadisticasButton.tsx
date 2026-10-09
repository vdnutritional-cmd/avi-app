'use client'

import { useState } from 'react'
import { buildReportHeader, printHtmlViaIframe } from '@/app/therapist/patients/[patientId]/print-utils'

// ── PrintEstadisticasButton — imprime estadísticas vía iframe (sin ventana emergente) (E3)
// Si el terapeuta pertenece a múltiples empresas con logo, muestra un modal
// para elegir con qué logo imprimir (Opción A).

interface Empresa {
  id: string
  nombre: string
  logo_url: string | null
}

interface PrintEstadisticasProps {
  terapeutaNombre: string
  empresas: Empresa[]
  mes: string
  tipoLabel: string
  reportTitle?: string   // default: "Mi Estadística"
  impresoPor?: string    // default: terapeutaNombre
  totalSesiones: number
  personasAtendidas: number
  institucionRows: { nombre: string; total: number; pct: number }[]
  motivoEntries: [string, number][]
  totalDerivaciones: number
  derivacionesPorTipo: Record<string, number>
  casosRiesgo: number
  asistSeguimiento: number
  percepcionAlivio: number
  cambioFunc: number
  abandono: number
  atenEspecializada: number
  calificaciones: { nombre: string; inicial: string; final: string }[]
  // Solo Reporte Institucional General
  tipoAsesoriaRows?: { nombre: string; total: number; virtuales: number; presenciales: number; proBono: number; facturables: number }[]
}

export default function PrintEstadisticasButton(props: PrintEstadisticasProps) {
  const [showModal, setShowModal] = useState(false)

  const empresasConLogo = props.empresas.filter(e => e.logo_url)

  function handleClick() {
    if (empresasConLogo.length > 1) {
      setShowModal(true)
    } else {
      // 0 o 1 empresa con logo → imprimir directo
      doPrint(empresasConLogo[0]?.logo_url ?? null)
    }
  }

  function doPrint(logoUrl: string | null) {
    setShowModal(false)
    const {
      terapeutaNombre, mes, tipoLabel,
      totalSesiones, personasAtendidas,
      institucionRows, motivoEntries,
      totalDerivaciones, derivacionesPorTipo,
      casosRiesgo, asistSeguimiento, percepcionAlivio, cambioFunc, abandono, atenEspecializada,
      calificaciones,
      tipoAsesoriaRows = [],
      reportTitle = 'Mi Estadística',
      impresoPor,
    } = props

    const nombreImpresion = impresoPor ?? terapeutaNombre

    const header = buildReportHeader({
      terapeutaNombre,
      impresoPor: nombreImpresion,
      logoUrl,
      side: logoUrl ? 'logo' : 'name',
      subtitle: `${reportTitle} · Pacientes ${tipoLabel} · ${mes}`,
    })

    const inst = institucionRows.map(r =>
      `<tr><td style="padding:5px 10px;">${r.nombre}</td><td style="padding:5px 10px;text-align:right;">${r.total}</td><td style="padding:5px 10px;text-align:right;">${r.pct}%</td></tr>`
    ).join('')

    const motivos = motivoEntries.slice(0, 10).map(([k, v]) =>
      `<tr><td style="padding:5px 10px;">${k}</td><td style="padding:5px 10px;text-align:right;">${v}</td></tr>`
    ).join('')

    const derivTipos = Object.entries(derivacionesPorTipo).map(([t, n]) =>
      `<li>${t}: <strong>${n}</strong></li>`
    ).join('')

    const calTable = calificaciones.map(c =>
      `<tr><td style="padding:4px 10px;">${c.nombre}</td><td style="padding:4px 10px;text-align:center;">${c.inicial}</td><td style="padding:4px 10px;text-align:center;">${c.final}</td></tr>`
    ).join('')

    const celda = (n: number) => n || ''
    const tipoRows = tipoAsesoriaRows.map(r =>
      `<tr><td style="padding:5px 10px;">${r.nombre}</td><td style="padding:5px 10px;text-align:right;">${celda(r.total)}</td><td style="padding:5px 10px;text-align:right;">${celda(r.virtuales)}</td><td style="padding:5px 10px;text-align:right;">${celda(r.presenciales)}</td><td style="padding:5px 10px;text-align:right;">${celda(r.proBono)}</td><td style="padding:5px 10px;text-align:right;">${celda(r.facturables)}</td></tr>`
    ).join('')
    const tipoTot = tipoAsesoriaRows.reduce((a, r) => ({
      total: a.total + r.total, virtuales: a.virtuales + r.virtuales, presenciales: a.presenciales + r.presenciales,
      proBono: a.proBono + r.proBono, facturables: a.facturables + r.facturables,
    }), { total: 0, virtuales: 0, presenciales: 0, proBono: 0, facturables: 0 })

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${reportTitle} — ${mes}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: letter; margin: 1cm 1.8cm 1.2cm; }
    html, body { margin: 0 !important; padding: 0 !important; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; line-height: 1.3; }
    h2 { font-size: 10.5pt; font-weight: 700; color: #2d3a8c; margin: 14px 0 6px; border-bottom: 1.5px solid #dde3ee; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5pt; }
    th { background: #f5f5f5; padding: 5px 10px; text-align: left; font-weight: 600; color: #555; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
    td { border-bottom: 1px solid #f0f0f0; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
    .kpi { background: #eef1f9; border: 1px solid #dde3ee; border-radius: 6px; padding: 10px 14px; }
    .kpi-label { font-size: 8.5pt; color: #5060a4; margin-bottom: 2px; }
    .kpi-value { font-size: 18pt; font-weight: 700; color: #2d3a8c; }
    .metric-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f3f3; font-size: 9.5pt; }
    ul { margin-left: 16px; font-size: 9.5pt; }
    li { margin-bottom: 2px; }
  </style>
</head>
<body>

  ${header}

  <h2>Resumen del periodo</h2>
  <div class="grid2">
    <div class="kpi"><div class="kpi-label">Cantidad de sesiones</div><div class="kpi-value">${totalSesiones}</div></div>
    <div class="kpi"><div class="kpi-label">Personas atendidas</div><div class="kpi-value">${personasAtendidas}</div></div>
  </div>

  ${tipoAsesoriaRows.length > 0 ? `
  <h3 style="font-size:9pt;font-weight:600;color:#777;text-transform:uppercase;letter-spacing:0.04em;margin:16px 0 4px;">Tipo de asesoría por terapeuta</h3>
  <table>
    <thead><tr><th>Terapeuta</th><th style="text-align:right;">Total</th><th style="text-align:right;">Virtuales</th><th style="text-align:right;">Presenciales</th><th style="text-align:right;">Pro-Bono</th><th style="text-align:right;">Facturables</th></tr></thead>
    <tbody>${tipoRows}
      <tr style="font-weight:700;background:#f5f5f5;"><td style="padding:5px 10px;">Total</td><td style="padding:5px 10px;text-align:right;">${tipoTot.total}</td><td style="padding:5px 10px;text-align:right;">${tipoTot.virtuales}</td><td style="padding:5px 10px;text-align:right;">${tipoTot.presenciales}</td><td style="padding:5px 10px;text-align:right;">${tipoTot.proBono}</td><td style="padding:5px 10px;text-align:right;">${tipoTot.facturables}</td></tr>
    </tbody>
  </table>` : ''}

  ${institucionRows.length > 0 ? `
  <h2>Sesiones por institución</h2>
  <table>
    <thead><tr><th>Institución</th><th style="text-align:right;">Sesiones</th><th style="text-align:right;">%</th></tr></thead>
    <tbody>${inst}</tbody>
  </table>` : ''}

  ${motivoEntries.length > 0 ? `
  <h2>Motivos de consulta más frecuentes</h2>
  <table>
    <thead><tr><th>Motivo / Tipo de caso</th><th style="text-align:right;">Pacientes</th></tr></thead>
    <tbody>${motivos}</tbody>
  </table>` : ''}

  <h2>Derivaciones${totalDerivaciones > 0 ? ` (${totalDerivaciones} total)` : ''}</h2>
  ${totalDerivaciones > 0 ? `<ul>${derivTipos}</ul>` : ''}
  <div style="margin-top:6px;">
    <div class="metric-row"><span>Casos con riesgo detectado</span><strong>${casosRiesgo}</strong></div>
    <div class="metric-row"><span>Asistencia a seguimiento</span><strong>${asistSeguimiento}</strong></div>
    <div class="metric-row"><span>Derivados a atención especializada</span><strong>${atenEspecializada}</strong></div>
  </div>

  <h2>Cierres</h2>
  <div style="margin-top:6px;">
    <div class="metric-row"><span>Cambio en funcionamiento</span><strong>${cambioFunc}</strong></div>
    <div class="metric-row"><span>Percepción de alivio del paciente</span><strong>${percepcionAlivio}</strong></div>
    <div class="metric-row"><span>Abandonos</span><strong>${abandono}</strong></div>
  </div>

  ${calificaciones.length > 0 ? `
  <h2>Calificaciones por paciente</h2>
  <table>
    <thead><tr><th>Paciente</th><th style="text-align:center;">Cal. Inicial</th><th style="text-align:center;">Cal. Final</th></tr></thead>
    <tbody>${calTable}</tbody>
  </table>` : ''}

</body>
</html>`

    printHtmlViaIframe(html)
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Imprimir estadística
      </button>

      {/* Modal de selección de logo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 max-w-[90vw]">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">¿Con qué logo deseas imprimir?</h3>
            <p className="text-xs text-gray-500 mb-4">Perteneces a más de una empresa CONVENIO.</p>

            <div className="flex flex-col gap-2">
              {empresasConLogo.map(e => (
                <button
                  key={e.id}
                  onClick={() => doPrint(e.logo_url)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.logo_url!} alt={e.nombre} className="h-8 w-20 object-contain shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{e.nombre}</span>
                </button>
              ))}

              {/* Opción sin logo */}
              <button
                onClick={() => doPrint(null)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-left"
              >
                <div className="h-8 w-20 shrink-0 flex items-center justify-center bg-gray-100 rounded text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Sin logo (nombre del terapeuta)</span>
              </button>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
