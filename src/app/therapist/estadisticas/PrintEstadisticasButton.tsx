'use client'

// ── PrintEstadisticasButton — abre ventana de impresión con estadísticas (E3)

interface PrintEstadisticasProps {
  terapeutaNombre: string
  mes: string              // e.g. "octubre de 2026"
  tipoLabel: string        // e.g. "activos"
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
}

export default function PrintEstadisticasButton(props: PrintEstadisticasProps) {
  function handlePrint() {
    const {
      terapeutaNombre, mes, tipoLabel,
      totalSesiones, personasAtendidas,
      institucionRows, motivoEntries,
      totalDerivaciones, derivacionesPorTipo,
      casosRiesgo, asistSeguimiento, percepcionAlivio, cambioFunc, abandono, atenEspecializada,
      calificaciones,
    } = props

    const date = new Date().toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric',
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

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Mi Estadística — ${mes}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; color: #222; padding: 32px 40px; line-height: 1.5; }
    h1 { font-size: 15pt; font-weight: 700; margin-bottom: 4px; }
    h2 { font-size: 11pt; font-weight: 600; color: #5b21b6; margin: 20px 0 8px; border-bottom: 1.5px solid #ede9fe; padding-bottom: 4px; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.5px solid #ddd; padding-bottom: 10px; margin-bottom: 16px; }
    .header-left { }
    .header-right { font-size: 9pt; color: #777; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5pt; }
    th { background: #f5f5f5; padding: 5px 10px; text-align: left; font-weight: 600; color: #555; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
    td { border-bottom: 1px solid #f0f0f0; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
    .kpi { background: #f8f5ff; border: 1px solid #ede9fe; border-radius: 8px; padding: 12px 16px; }
    .kpi-label { font-size: 8.5pt; color: #777; margin-bottom: 2px; }
    .kpi-value { font-size: 20pt; font-weight: 700; color: #5b21b6; }
    .metric-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f3f3; font-size: 9.5pt; }
    ul { margin-left: 16px; font-size: 9.5pt; }
    li { margin-bottom: 2px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>

  <div class="header-bar">
    <div class="header-left">
      <h1>Mi Estadística</h1>
      <div style="font-size:9pt;color:#666;">Pacientes ${tipoLabel} · ${mes}</div>
    </div>
    <div class="header-right">
      ${date}<br/>
      Reporte impreso por: <strong>${terapeutaNombre}</strong>
    </div>
  </div>

  <h2>Resumen del periodo</h2>
  <div class="grid2">
    <div class="kpi"><div class="kpi-label">Cantidad de sesiones</div><div class="kpi-value">${totalSesiones}</div></div>
    <div class="kpi"><div class="kpi-label">Personas atendidas</div><div class="kpi-value">${personasAtendidas}</div></div>
  </div>

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

  ${totalDerivaciones > 0 ? `
  <h2>Derivaciones (${totalDerivaciones} total)</h2>
  <ul>${derivTipos}</ul>` : ''}

  <h2>Métricas de cierres y seguimiento</h2>
  <div style="margin-top:6px;">
    <div class="metric-row"><span>Casos con riesgo detectado</span><strong>${casosRiesgo}</strong></div>
    <div class="metric-row"><span>Asistencia a seguimiento</span><strong>${asistSeguimiento}</strong></div>
    <div class="metric-row"><span>Percepción de alivio del paciente</span><strong>${percepcionAlivio}</strong></div>
    <div class="metric-row"><span>Cambio en funcionamiento</span><strong>${cambioFunc}</strong></div>
    <div class="metric-row"><span>Abandonos</span><strong>${abandono}</strong></div>
    <div class="metric-row"><span>Derivados a atención especializada</span><strong>${atenEspecializada}</strong></div>
  </div>

  ${calificaciones.length > 0 ? `
  <h2>Calificaciones por paciente</h2>
  <table>
    <thead><tr><th>Paciente</th><th style="text-align:center;">Cal. Inicial</th><th style="text-align:center;">Cal. Final</th></tr></thead>
    <tbody>${calTable}</tbody>
  </table>` : ''}

</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { alert('Permite ventanas emergentes para imprimir.'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
  }

  return (
    <button
      onClick={handlePrint}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Imprimir estadística
    </button>
  )
}
