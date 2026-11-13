// ─────────────────────────────────────────────────────────────
// Reporte "Consentimiento Informado y firma electrónica" (13 nov 2026). Un solo formato para:
//   - el <pro>: Reportes terapéuticos › AVI-Esencial (print-utils.ts › imprimirConsentimientoDesdeReportes)
//   - la persona: Mi privacidad y consentimiento (/patient/privacidad: pantalla y PDF)
// Texto exacto que firmó (el guardado, con su versión) + datos de la firma + historial.
// Sin dependencias de navegador ni de servidor: lo usan las dos pantallas.
// ─────────────────────────────────────────────────────────────
import { textoLegalHtml } from './texto-legal'
import { nombreOpcion, NOMBRE_ORIGEN, type OpcionEscucha, type OrigenFirma } from './consentimiento'
import { terminos, type Terminologia } from './terminologia'

export interface FirmaReporte {
  version: number; opcion: OpcionEscucha; origen: OrigenFirma
  firmado_at: string; ip: string | null; dispositivo: string; sha256: string
}

export interface DatosReporteConsentimiento {
  nombre: string
  email: string | null
  terminologia: Terminologia
  /** Texto exacto de la firma vigente (firmas[0]) */
  textoVigente: string
  /** De la más reciente a la primera */
  firmas: FirmaReporte[]
}

export const fechaHoraFirma = (iso: string) => new Date(iso).toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

/** Filas del recuadro "Firma electrónica" (mismo orden en pantalla y en PDF) */
export function filasFirma(d: DatosReporteConsentimiento): [string, string][] {
  const w = terminos(d.terminologia)
  const f = d.firmas[0]
  return [
    [w.User, d.nombre],
    ['Correo de su cuenta en AVI', d.email ?? '—'],
    ['Fecha y hora de la firma', `${fechaHoraFirma(f.firmado_at)} (hora del centro de México)`],
    ['Versión del Consentimiento', String(f.version)],
    ['Opción elegida (Escucha de AVI)', nombreOpcion(f.opcion, d.terminologia)],
    ['Dónde firmó', NOMBRE_ORIGEN[f.origen]],
    ['Dirección IP', f.ip ?? '—'],
    ['Dispositivo', f.dispositivo],
    ['Huella del texto firmado (SHA-256)', f.sha256],
  ]
}

export const SUBTITULO_CONSENTIMIENTO = 'Consentimiento Informado y firma electrónica'

export const SELLO_FIRMA = '✔ ACEPTADO Y FIRMADO ELECTRÓNICAMENTE'

export function notaFirma(t: Terminologia): string {
  const u = terminos(t).user
  return `La firma se otorgó en la plataforma AVI con la cuenta del ${u}, marcando la casilla de aceptación. El registro se guardó con la fecha y hora del servidor y no se puede modificar ni borrar. La huella SHA-256 identifica el texto exacto que el ${u} leyó y aceptó: cualquier cambio en el texto produciría una huella distinta.`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Documento HTML completo para printHtmlViaIframe; `encabezado` = buildReportHeader(...) */
export function htmlReporteConsentimiento(d: DatosReporteConsentimiento, encabezado: string): string {
  const w = terminos(d.terminologia)
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Consentimiento Informado — ${esc(d.nombre)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: letter; margin: 1cm 1.8cm 1.2cm; }
html, body { margin: 0 !important; padding: 0 !important; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; line-height: 1.35; }
.persona { font-size: 9.5pt; margin-bottom: 8pt; }
.texto h2 { color: #2d3a8c; font-size: 11pt; margin: 12pt 0 6pt; border-bottom: 0.5pt solid #b0bbd4; padding-bottom: 2pt; }
.texto h3 { color: #2d3a8c; font-size: 9.5pt; margin: 9pt 0 4pt; }
.texto p { margin: 0 0 5pt; text-align: justify; }
.texto ul { margin: 0 0 5pt 14pt; } .texto li { margin-bottom: 2pt; }
.firma { margin-top: 14pt; border: 1.5pt solid #2d3a8c; border-radius: 4pt; padding: 8pt 10pt; page-break-inside: avoid; }
.firma-titulo { color: #2d3a8c; font-weight: bold; font-size: 10.5pt; margin-bottom: 4pt; }
.sello { display: inline-block; color: #047857; border: 1pt solid #047857; border-radius: 3pt; padding: 1pt 6pt; font-weight: bold; font-size: 8.5pt; margin-bottom: 6pt; }
table { width: 100%; border-collapse: collapse; }
td, th { border: 0.5pt solid #b0bbd4; padding: 3pt 5pt; vertical-align: top; text-align: left; }
td.k { width: 34%; background: #eef1f9; font-weight: bold; color: #2d3a8c; }
td.v { word-break: break-all; }
th { background: #eef1f9; color: #2d3a8c; font-size: 8pt; }
.historial { margin-top: 12pt; page-break-inside: avoid; }
.historial td { font-size: 8pt; }
.nota { font-size: 7.5pt; color: #666; margin-top: 6pt; text-align: justify; }
</style></head><body>
${encabezado}
<div class="persona"><strong>${esc(w.User)}:</strong> ${esc(d.nombre)}</div>
<div class="texto">${textoLegalHtml(d.textoVigente)}</div>

<div class="firma">
  <div class="firma-titulo">Firma electrónica del ${esc(w.user)}</div>
  <div class="sello">${SELLO_FIRMA}</div>
  <table>${filasFirma(d).map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('')}</table>
  <p class="nota">${esc(notaFirma(d.terminologia))}</p>
</div>

${d.firmas.length > 1 ? `<div class="historial">
  <div class="firma-titulo">Historial de firmas (${d.firmas.length})</div>
  <table>
    <tr><th>Fecha y hora</th><th>Versión</th><th>Opción elegida</th><th>Dónde firmó</th><th>IP · Dispositivo</th></tr>
    ${d.firmas.map(f => `<tr><td>${esc(fechaHoraFirma(f.firmado_at))}</td><td>${f.version}</td><td>${esc(nombreOpcion(f.opcion, d.terminologia))}</td><td>${esc(NOMBRE_ORIGEN[f.origen])}</td><td>${esc(f.ip ?? '—')} · ${esc(f.dispositivo)}</td></tr>`).join('')}
  </table>
</div>` : ''}
</body>
</html>`
}
