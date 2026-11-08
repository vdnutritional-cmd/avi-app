'use client'

// Los dos pasos del Consentimiento Informado v2 (8 nov 2026, src/lib/consentimiento.ts):
//   - <TuPrivacidad>: "Tu privacidad importa" con las 3 opciones de la Escucha de AVI y los Derechos ARCO
//   - <AcuerdoConsentimiento>: el Acuerdo con la opción elegida y la casilla con la que se firma
// Los usan el registro por QR, el onboarding y /patient/consentimiento (cambio por Derechos ARCO
// o versión nueva). La firma la guarda el servidor con el mismo texto.
import TextoLegal from '@/components/TextoLegal'
import {
  textosPrivacidad, textoConsentimiento, tituloConsentimiento, TEXTO_CASILLA,
  type OpcionEscucha,
} from '@/lib/consentimiento'
import type { Terminologia } from '@/lib/terminologia'

export function TuPrivacidad({ terminologia, opcion, onOpcion }: {
  terminologia: Terminologia
  opcion: OpcionEscucha | null
  onOpcion: (o: OpcionEscucha) => void
}) {
  const p = textosPrivacidad(terminologia)
  return (
    <div className="space-y-4">
      <TextoLegal texto={p.intro} />
      <div className="space-y-3" role="radiogroup">
        {p.opciones.map(o => (
          <label key={o.valor}
            className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer transition-colors
              ${opcion === o.valor ? 'border-primary-500 bg-primary-50' : 'border-primary-200 bg-white hover:bg-gray-50'}`}>
            <input type="radio" name="opcion_escucha" checked={opcion === o.valor} onChange={() => onOpcion(o.valor)}
              className="mt-1 accent-primary-600 w-4 h-4 flex-shrink-0" />
            <span className="space-y-1">
              <span className="block text-sm font-semibold text-primary-700">{o.titulo}</span>
              <span className="block text-sm text-gray-600 leading-relaxed text-justify">{o.texto}</span>
            </span>
          </label>
        ))}
      </div>
      {/* "Tus Derechos ARCO." como título en color AVI; el resto, igual */}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-primary-700">Tus Derechos ARCO</p>
        <TextoLegal texto={p.arco.replace(/^\*\*Tus Derechos ARCO\.\*\*\s*/, '')} />
      </div>
    </div>
  )
}

export function AcuerdoConsentimiento({ terminologia, opcion, empresa, acepto, onAcepto }: {
  terminologia: Terminologia
  opcion: OpcionEscucha
  empresa: string | null
  acepto: boolean
  onAcepto: (v: boolean) => void
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-gray-800 text-center leading-snug">📋 {tituloConsentimiento(terminologia)}</h3>
      <TextoLegal texto={textoConsentimiento({ terminologia, opcion, empresa })} />
      <label className="flex items-start gap-3 bg-white border-2 border-primary-200 rounded-2xl px-4 py-4 cursor-pointer">
        <input type="checkbox" checked={acepto} onChange={e => onAcepto(e.target.checked)}
          className="mt-0.5 accent-primary-600 w-5 h-5 flex-shrink-0" />
        <TextoLegal texto={TEXTO_CASILLA} className="!text-gray-700 font-medium" />
      </label>
    </div>
  )
}
