'use client'

// PDF del Consentimiento firmado (texto exacto guardado + datos de la firma). Imprime con iframe (nunca window.open).
import { printHtmlViaIframe } from '@/app/therapist/patients/[patientId]/print-utils'
import { textoLegalHtml } from '@/lib/texto-legal'

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default function DescargarConsentimiento({ nombre, texto, datos }: {
  nombre: string
  texto: string
  datos: [string, string][]
}) {
  function imprimir() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Consentimiento Informado — ${escapar(nombre)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: letter; margin: 1cm 1.8cm 1.2cm; }
html, body { margin: 0 !important; padding: 0 !important; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; line-height: 1.35; }
.marca { color: #c026d3; font-weight: bold; font-size: 11pt; border-bottom: 1.5px solid #2d3a8c; padding-bottom: 6pt; margin-bottom: 10pt; }
h2 { color: #2d3a8c; font-size: 11pt; margin: 12pt 0 6pt; }
h3 { color: #2d3a8c; font-size: 9.5pt; margin: 9pt 0 4pt; }
p { margin: 0 0 5pt; text-align: justify; }
ul { margin: 0 0 5pt 14pt; } li { margin-bottom: 2pt; }
table { width: 100%; border-collapse: collapse; margin-top: 12pt; }
td { border: 1px solid #b0bbd4; padding: 3pt 5pt; vertical-align: top; }
td:first-child { width: 32%; background: #eef1f9; font-weight: bold; color: #2d3a8c; }
.firma { word-break: break-all; }
</style></head><body>
<div class="marca">AVI — Constancia de Consentimiento Informado</div>
<p><strong>Persona:</strong> ${escapar(nombre)}</p>
${textoLegalHtml(texto)}
<h2>Datos de la firma electrónica</h2>
<table>${datos.map(([k, v]) => `<tr><td>${escapar(k)}</td><td class="firma">${escapar(v)}</td></tr>`).join('')}</table>
</body></html>`
    printHtmlViaIframe(html)
  }

  return (
    <button type="button" onClick={imprimir}
      className="w-full text-sm font-semibold bg-white border-2 border-primary-200 text-primary-700 hover:bg-primary-50 px-4 py-3 rounded-2xl transition-colors">
      ⬇︎ Descargar mi Consentimiento (PDF)
    </button>
  )
}
