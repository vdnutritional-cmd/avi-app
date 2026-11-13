'use client'

// PDF del Consentimiento firmado: mismo formato que el reporte del <pro> en Reportes terapéuticos
// (src/lib/consentimiento-reporte.ts), impreso por la persona. Iframe (nunca window.open).
import { buildReportHeader, printHtmlViaIframe } from '@/app/therapist/patients/[patientId]/print-utils'
import { htmlReporteConsentimiento, SUBTITULO_CONSENTIMIENTO, type DatosReporteConsentimiento } from '@/lib/consentimiento-reporte'

export default function DescargarConsentimiento({ datos, proNombre, logoUrl }: {
  datos: DatosReporteConsentimiento
  proNombre: string
  logoUrl: string | null
}) {
  function imprimir() {
    printHtmlViaIframe(htmlReporteConsentimiento(datos, buildReportHeader({
      terapeutaNombre: proNombre, impresoPor: datos.nombre, terminologia: datos.terminologia,
      logoUrl, side: logoUrl ? 'logo' : 'name', subtitle: SUBTITULO_CONSENTIMIENTO,
    })))
  }

  return (
    <button type="button" onClick={imprimir}
      className="w-full text-sm font-semibold bg-white border-2 border-primary-200 text-primary-700 hover:bg-primary-50 px-4 py-3 rounded-2xl transition-colors">
      ⬇︎ Descargar mi Consentimiento (PDF)
    </button>
  )
}
