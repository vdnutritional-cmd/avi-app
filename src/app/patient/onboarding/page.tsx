'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { aplicarTerminologia, TERMINOLOGIA_SIN_EMPRESA, type Terminologia } from '@/lib/terminologia'
import type { OpcionEscucha } from '@/lib/consentimiento'
import { AcuerdoConsentimiento, TuPrivacidad } from '@/components/consentimiento/PasosConsentimiento'

// Textos con <user>/<pro>/<serv>: se cambian según la empresa del paciente (Inventario de Terminología, página 1)
// Primera entrada (8 nov 2026): Bienvenida, ¿Cómo funciona? e Importante que sepas. "Tu privacidad importa"
// y el Consentimiento Informado se firman en el registro por QR; si la persona no los firmó ahí
// (p. ej. se registró por código), aparecen aquí también (src/lib/consentimiento.ts).

type Paso = { icono: string; titulo: string; contenido?: string; requiereCheckbox?: boolean; textoCheckbox?: string; especial?: 'privacidad' | 'consentimiento' }

const BIENVENIDA: Paso[] = [
  {
    icono: '👋',
    titulo: 'Bienvenido y platícame...',
    contenido: `AVI es un espacio de escucha cálida y acompañamiento emocional entre tus sesiones de <serv>.

El nombre de AVI viene de "Acompañamiento Virtual Interactivo" y está constituido desde una visión con valores católicos desde la visión Personalista de Karol Józef Wojtyla, basada en el respeto a tu dignidad como persona en todas sus dimensiones, ya que eres una persona única e irrepetible.`,
  },
  {
    icono: '🎙️',
    titulo: '¿Cómo funciona?',
    contenido: `Platicas con AVI por voz, como una llamada, o por escrito, como un chat. Cuéntale cómo te sientes, qué te preocupa o qué viviste desde tu última sesión con tu <pro>.

AVI escucha, te hace preguntas y te acompaña. Al terminar, guarda un breve resumen que tu <pro> podrá conocer para darte un mejor acompañamiento en la siguiente sesión.`,
  },
  {
    icono: '⚠️',
    titulo: 'Importante que sepas',
    contenido: `AVI NO es un terapeuta, consultor o asesor. NO hace diagnósticos. NO reemplaza la atención de tu <pro> personal.

Si en algún momento sientes que estás en crisis o en peligro, llama a la Línea de la Vida: 800 911 2000 (gratuita, 24 horas).

Para cualquier otro apoyo, {{CONTACTO}}.`,
    requiereCheckbox: true,
    textoCheckbox: 'Entiendo que AVI es un acompañamiento, no una terapia, y que debo contactar a mi <pro> para mi proceso profesional.',
  },
]
const [PASO_BIENVENIDA, PASO_COMO, PASO_IMPORTANTE] = BIENVENIDA
const PASO_PRIVACIDAD: Paso = { icono: '🔒', titulo: 'Tu privacidad importa', especial: 'privacidad' }
const PASO_CONSENTIMIENTO: Paso = { icono: '📋', titulo: '', especial: 'consentimiento' }

export default function OnboardingPage() {
  const router = useRouter()
  const [paso, setPaso] = useState(0)
  const [aceptadoGeneral, setAceptadoGeneral] = useState(false)
  const [aceptadoConsentimiento, setAceptadoConsentimiento] = useState(false)
  const [opcion, setOpcion] = useState<OpcionEscucha | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [contacto, setContacto] = useState('contacta a tu <pro>')
  // null = aún cargando: los textos esperan para no cambiar de palabra frente al paciente
  const [terminologia, setTerminologia] = useState<Terminologia | null>(null)
  // ¿Falta firmar el Consentimiento v2? (null = aún no se sabe)
  const [faltaFirma, setFaltaFirma] = useState<boolean | null>(null)
  const [empresa, setEmpresa] = useState<string | null>(null)

  // Contacto y terminología según la empresa CONVENIO del paciente, o el teléfono del terapeuta si no tiene empresa
  useEffect(() => {
    fetch('/api/patient/contacto')
      .then(r => r.json())
      .then((d: { destino?: string; terminologia?: Terminologia }) => {
        if (d.destino) setContacto(`contacta a ${d.destino}`)
        setTerminologia(d.terminologia ?? TERMINOLOGIA_SIN_EMPRESA)
      })
      .catch(() => setTerminologia(TERMINOLOGIA_SIN_EMPRESA))
    fetch('/api/patient/consentimiento')
      .then(r => r.json())
      .then((d: { alDia?: boolean; empresa?: string | null }) => { setFaltaFirma(!d.alDia); setEmpresa(d.empresa ?? null) })
      .catch(() => setFaltaFirma(true))
  }, [])
  const t = (texto: string) => aplicarTerminologia(texto, terminologia ?? TERMINOLOGIA_SIN_EMPRESA)

  const pasos: Paso[] = faltaFirma
    ? [PASO_BIENVENIDA, PASO_COMO, PASO_PRIVACIDAD, PASO_IMPORTANTE, PASO_CONSENTIMIENTO]
    : BIENVENIDA
  const esUltimo = paso === pasos.length - 1
  const actual = pasos[paso]

  const puedeAvanzar = actual.especial === 'privacidad' ? opcion !== null
    : actual.especial === 'consentimiento' ? aceptadoConsentimiento
    : actual.requiereCheckbox ? aceptadoGeneral : true

  function siguiente() {
    if (!puedeAvanzar || esUltimo) return
    setPaso(p => p + 1)
    window.scrollTo(0, 0)
  }

  async function comenzar() {
    if (!puedeAvanzar || faltaFirma === null) return
    setGuardando(true); setError('')
    // 1. Firma del Consentimiento v2 (la guarda el servidor, con IP y dispositivo)
    if (faltaFirma) {
      const res = await fetch('/api/patient/consentimiento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opcion, acepto: aceptadoConsentimiento }),
      }).catch(() => null)
      const json = res ? await res.json().catch(() => ({})) : {}
      if (!res?.ok) {
        setError(json.error ?? 'No se pudo guardar tu Consentimiento. Revisa tu conexión e intenta de nuevo.')
        setGuardando(false)
        return
      }
    }
    // 2. Primera entrada (desde aquí se cuentan las sesiones AVI: limite-sesiones-avi.ts)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const ahora = new Date().toISOString()
        await supabase
          .from('patient_consents')
          .upsert({
            patient_id: user.id,
            general_consent_at: aceptadoGeneral ? ahora : null,
            informed_consent_at: ahora,
          })
      }
    } finally {
      router.push('/patient/chat')
    }
  }

  const listo = terminologia !== null && faltaFirma !== null

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-primary-50 via-white to-calm-50">
      <div className="w-full max-w-sm flex flex-col min-h-screen">

        {/* Progreso */}
        <div className="flex gap-2 px-6 pt-10">
          {pasos.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= paso ? 'bg-primary-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-5">
          {listo && actual.especial === 'consentimiento' && opcion ? (
            <AcuerdoConsentimiento terminologia={terminologia} opcion={opcion} empresa={empresa}
              acepto={aceptadoConsentimiento} onAcepto={setAceptadoConsentimiento} />
          ) : listo && (
            <>
              <div className="text-center space-y-3">
                <div className="text-5xl">{actual.icono}</div>
                <h2 className={`text-lg font-bold leading-snug ${actual.especial === 'privacidad' ? 'text-primary-700' : 'text-gray-800'}`}>{actual.titulo}</h2>
              </div>

              {actual.especial === 'privacidad' ? (
                <TuPrivacidad terminologia={terminologia} opcion={opcion} onOpcion={setOpcion} />
              ) : (
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line text-center">
                  {t((actual.contenido ?? '').replace('{{CONTACTO}}', contacto))}
                </p>
              )}

              {/* Checkbox */}
              {actual.requiereCheckbox && (
                <label className="flex items-start gap-3 bg-white border-2 border-primary-200 rounded-2xl px-4 py-4 cursor-pointer mt-4">
                  <input
                    type="checkbox"
                    checked={aceptadoGeneral}
                    onChange={e => setAceptadoGeneral(e.target.checked)}
                    className="mt-0.5 accent-primary-600 w-5 h-5 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700 leading-relaxed font-medium">
                    {t(actual.textoCheckbox ?? '')}
                  </span>
                </label>
              )}
            </>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}
        </div>

        {/* Botones */}
        <div className="px-6 pb-10 space-y-3">
          {esUltimo ? (
            <button
              onClick={comenzar}
              disabled={!listo || !puedeAvanzar || guardando}
              className="w-full py-4 bg-primary-600 text-white font-semibold rounded-2xl
                         hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {guardando ? 'Guardando...' : faltaFirma ? 'Acepto y firmo · Comenzar con AVI' : 'Comenzar con AVI'}
            </button>
          ) : (
            <button
              onClick={siguiente}
              disabled={!listo || !puedeAvanzar}
              className="w-full py-4 bg-primary-600 text-white font-semibold rounded-2xl
                         hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          )}

          {paso > 0 && (
            <button
              onClick={() => { setPaso(p => p - 1); window.scrollTo(0, 0) }}
              className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Anterior
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
