// ─────────────────────────────────────────────────────────────
// Reporte de la Atención — función de impresión compartida
// Usada en ReportesPageClient (desktop) y ReportesPanel (móvil)
// ─────────────────────────────────────────────────────────────

import {
  buildReportHeader,
  printHtmlViaIframe,
} from '../patients/[patientId]/print-utils'

// ── Tipos ─────────────────────────────────────────────────────
export interface SesionResumen {
  fecha: string; numero: number
  intervencion: string; acuerdo: string; seguimiento: string
}
export interface FactorGrupo { esquema: string; items: string[] }
export interface ItemFecha   { fecha: string; texto: string }

export interface ReporteAtencionData {
  paciente_nombre:             string
  terapeuta_nombre:            string
  tipo_caso:                   string
  problematica:                string
  motivo_subyacente:           string
  motivo_consulta:             string
  emociones:                   ItemFecha[]
  recursos:                    ItemFecha[]
  factores_riesgo:             FactorGrupo[]
  factores_proteccion:         FactorGrupo[]
  sesiones_resumenes:          SesionResumen[]
  derivacion_tipos:            string[]
  atencion_especializada:      string
  atencion_especializada_cual: string
  total_sesiones:              number
  terapeutaNombre:             string
  logoUrl:                     string | null
}

// ── Función principal ─────────────────────────────────────────
export function imprimirReporteAtencion(data: ReporteAtencionData) {
  const {
    paciente_nombre, tipo_caso, problematica, motivo_subyacente, motivo_consulta,
    emociones, recursos, factores_riesgo, factores_proteccion,
    sesiones_resumenes, derivacion_tipos, atencion_especializada,
    atencion_especializada_cual, total_sesiones,
    terapeutaNombre, logoUrl,
  } = data

  const encabezado = buildReportHeader({
    terapeutaNombre,
    logoUrl,
    side: logoUrl ? 'logo' : 'name',
  })

  const listaFechas = (items: ItemFecha[]) =>
    items.length === 0
      ? '<p class="empty">Sin datos registrados en el periodo.</p>'
      : items.map(i =>
          `<div class="fecha-item">
             <div class="fecha-label">${i.fecha}</div>
             <div class="fecha-texto">${i.texto.replace(/\n/g, '<br>')}</div>
           </div>`
        ).join('')

  const factoresHtml = (grupos: FactorGrupo[]) =>
    grupos.length === 0
      ? '<p class="empty">Sin factores registrados.</p>'
      : grupos.map(g =>
          `<div class="factor-schema">${g.esquema}</div>
           <ul class="factor-list">${g.items.map(f => `<li>${f}</li>`).join('')}</ul>`
        ).join('')

  const resumenFecha = (campo: keyof SesionResumen) =>
    sesiones_resumenes.length === 0
      ? '<p class="empty">Sin sesiones en el periodo.</p>'
      : sesiones_resumenes.map(s => `
          <div class="fecha-item">
            <div class="fecha-label">Sesión ${s.numero} · ${s.fecha}</div>
            <div class="fecha-texto">${((s[campo] as string) || '—').replace(/\n/g, '<br>')}</div>
          </div>`
        ).join('')

  const derivStr = derivacion_tipos.length > 0 ? derivacion_tipos.join(', ') : 'n/a'
  const atEspStr = atencion_especializada === 'SI' && atencion_especializada_cual
    ? `Sí — ${atencion_especializada_cual}`
    : atencion_especializada === 'SI' ? 'Sí' : 'No aplica'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Reporte de la Atención — ${paciente_nombre}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    @page { margin:2.2cm 2.5cm; }
    body { font-family:'Georgia','Times New Roman',serif; font-size:10.5pt; color:#1a1a1a; line-height:1.6; }
    .doc-title { text-align:center; border-bottom:2pt solid #2d3a8c; border-top:0.5pt solid #2d3a8c;
                 padding:10pt 0; margin-bottom:14pt; }
    .doc-title h1 { font-size:14pt; letter-spacing:0.5pt; color:#2d3a8c; text-transform:uppercase; }
    .doc-title .sub { font-size:10pt; color:#5060a4; font-style:italic; margin-top:2pt; }
    .meta { display:flex; justify-content:space-between; margin-bottom:18pt; font-size:9.5pt;
            color:#444; background:#f4f6fb; padding:6pt 10pt; border-radius:4pt; }
    .meta strong { color:#1a1a1a; }
    .section { margin-bottom:16pt; }
    .section-title { font-size:10.5pt; font-weight:bold; color:#2d3a8c; text-transform:uppercase;
                     letter-spacing:0.4pt; border-bottom:1pt solid #b0bbd4;
                     padding-bottom:4pt; margin-bottom:10pt; }
    .section-title .num { font-size:9pt; font-weight:normal; margin-right:4pt; opacity:0.7; }
    .section-body { font-size:10pt; line-height:1.65; color:#1a1a1a; white-space:pre-wrap; }
    .empty { color:#999; font-style:italic; font-size:9.5pt; }
    .fecha-item { margin-bottom:10pt; padding-left:8pt; border-left:2pt solid #c8d0e8; }
    .fecha-label { font-size:9pt; font-weight:bold; color:#2d3a8c; margin-bottom:2pt; }
    .fecha-texto { font-size:10pt; color:#1a1a1a; line-height:1.6; }
    .factor-schema { font-size:9.5pt; font-weight:bold; color:#2d3a8c; margin:6pt 0 3pt; }
    .factor-list   { list-style:disc; padding-left:18pt; font-size:10pt; margin-bottom:6pt; }
    .deriv-row { display:flex; gap:12pt; margin-bottom:6pt; }
    .deriv-label { font-weight:bold; color:#333; min-width:140pt; font-size:10pt; }
    .deriv-val { font-size:10pt; color:#1a1a1a; }
    .firma-section { margin-top:28pt; border-top:1pt solid #ccc; padding-top:14pt;
                     display:grid; grid-template-columns:1fr 1fr; gap:30pt; }
    .firma-item { text-align:center; }
    .firma-linea { border-top:1pt solid #333; padding-top:5pt; font-size:9.5pt; color:#444; }
    .firma-name { margin-top:4pt; font-size:9.5pt; font-weight:bold; color:#1a1a1a; }
    .firma-label { font-size:10pt; font-weight:bold; color:#333; margin-bottom:20pt; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:right;padding:10pt 0 14pt;">
    <button onclick="window.print()"
      style="padding:8pt 18pt;background:#2d3a8c;color:white;border:none;border-radius:8pt;font-size:10pt;cursor:pointer;">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>
  ${encabezado}
  <div class="doc-title">
    <h1>Reporte de la Atención</h1>
    <div class="sub">Reporte terapéutico integral</div>
  </div>
  <div class="meta">
    <div><strong>Asesorado:</strong> ${paciente_nombre}</div>
    <div><strong>Total sesiones en el periodo:</strong> ${total_sesiones}</div>
  </div>
  <div class="section">
    <div class="section-title"><span class="num">1.</span> Motivo de Consulta</div>
    ${tipo_caso ? `<div class="section-body"><strong>Tipo de caso:</strong> ${tipo_caso}</div>` : ''}
    ${problematica ? `<div class="section-body" style="margin-top:4pt;"><strong>Problemática:</strong> ${problematica.replace(/\n/g, '<br>')}</div>` : ''}
    ${motivo_subyacente ? `<div class="section-body" style="margin-top:4pt;"><strong>Motivo subyacente:</strong> ${motivo_subyacente.replace(/\n/g, '<br>')}</div>` : ''}
    ${!tipo_caso && !problematica && !motivo_subyacente ? '<p class="empty">Sin información registrada.</p>' : ''}
  </div>
  <div class="section">
    <div class="section-title"><span class="num">2.</span> Situación Principal</div>
    ${motivo_consulta ? `<div class="section-body">${motivo_consulta.replace(/\n/g, '<br>')}</div>` : '<p class="empty">Sin registrar.</p>'}
  </div>
  <div class="section">
    <div class="section-title"><span class="num">3.</span> Emociones Identificadas</div>
    ${listaFechas(emociones)}
  </div>
  <div class="section">
    <div class="section-title"><span class="num">4.</span> Recursos Personales del Paciente</div>
    ${listaFechas(recursos)}
  </div>
  <div class="section">
    <div class="section-title"><span class="num">5.</span> Factores de Riesgo y Protección</div>
    <div style="margin-bottom:8pt;">
      <div style="font-size:9pt;font-weight:bold;color:#444;text-transform:uppercase;letter-spacing:0.3pt;margin-bottom:4pt;">Factores de riesgo</div>
      ${factoresHtml(factores_riesgo)}
    </div>
    <div>
      <div style="font-size:9pt;font-weight:bold;color:#444;text-transform:uppercase;letter-spacing:0.3pt;margin-bottom:4pt;">Factores de protección</div>
      ${factoresHtml(factores_proteccion)}
    </div>
  </div>
  <div class="section">
    <div class="section-title"><span class="num">6.</span> Intervención Realizada</div>
    ${resumenFecha('intervencion')}
  </div>
  <div class="section">
    <div class="section-title"><span class="num">7.</span> Acuerdos</div>
    ${resumenFecha('acuerdo')}
  </div>
  <div class="section">
    <div class="section-title"><span class="num">8.</span> Seguimiento</div>
    ${resumenFecha('seguimiento')}
  </div>
  <div class="section">
    <div class="section-title"><span class="num">9.</span> Derivación y Atención Especializada</div>
    <div class="deriv-row"><span class="deriv-label">Derivación:</span><span class="deriv-val">${derivStr}</span></div>
    <div class="deriv-row"><span class="deriv-label">Atención especializada:</span><span class="deriv-val">${atEspStr}</span></div>
  </div>
  <div class="firma-section">
    <div class="firma-item">
      <div class="firma-label">Elabora</div>
      <div class="firma-linea">
        <div class="firma-name">${terapeutaNombre}</div>
        <div style="font-size:8.5pt;color:#666;">Nombre y firma del Terapeuta</div>
      </div>
    </div>
    <div class="firma-item">
      <div class="firma-label">VoBo</div>
      <div class="firma-linea">
        <div class="firma-name">&nbsp;</div>
        <div style="font-size:8.5pt;color:#666;">Nombre y firma</div>
      </div>
    </div>
  </div>
</body>
</html>`

  printHtmlViaIframe(html)
}
