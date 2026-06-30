'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const pasos = [
  {
    icono: '👋',
    titulo: 'Bienvenido a Recupérate',
    contenido: `AVI es un espacio de escucha cálida y acompañamiento emocional entre tus sesiones de terapia.

El nombre de AVI viene de "Acompañamiento Virtual Interactivo" y está constituido desde una visión con valores católicos desde la visión Personalista de Karol Józef Wojtyla, basada en el respeto a tu dignidad como persona en todas sus dimensiones, ya que eres una persona única e irrepetible.`,
  },
  {
    icono: '🎙️',
    titulo: '¿Cómo funciona?',
    contenido: `Hablas con AVI por voz — como una llamada. Cuéntale cómo te sientes, qué te preocupa o qué viviste desde tu última sesión con tu terapeuta.

AVI escucha, te hace preguntas y te acompaña. Al terminar, guarda un breve resumen que tu terapeuta podrá conocer para darte un mejor acompañamiento en la siguiente sesión.`,
  },
  {
    icono: '🔒',
    titulo: 'Tu privacidad importa',
    contenido: `Tu terapeuta NO escucha las conversaciones. Solo ve un resumen de los temas que exploraste y las emociones que surgieron.

Tus mensajes están protegidos. AVI no comparte tu información con nadie más.`,
  },
  {
    icono: '⚠️',
    titulo: 'Importante que sepas',
    contenido: `AVI NO es un terapeuta. NO hace diagnósticos. NO reemplaza la atención de tu terapeuta personal.

Si en algún momento sientes que estás en crisis o en peligro, llama a la Línea de la Vida: 800 911 2000 (gratuita, 24 horas).

Para cualquier otro apoyo, contacta a tu terapeuta o a VALORA al 33 1363 0266.`,
    requiereCheckbox: true,
    textoCheckbox: 'Entiendo que AVI es un acompañamiento, no una terapia, y que debo contactar a mi terapeuta para mi proceso profesional.',
  },
  {
    icono: '📋',
    titulo: 'Acuerdo de Consentimiento Informado para tu Acompañamiento',
    contenido: `I.- Por este medio manifiesto y otorgo libre y voluntariamente mi Consentimiento Informado con respecto a la realización de entrevistas presenciales, virtuales o interactivas a través de esta plataforma o algún otro medio presencial o virtual, así como la aplicación de pruebas o test que me propongan realizar con el fin de verificar o evaluar o diagnosticar mi situación personal; y hago constar que estoy de acuerdo y dispuesto(a) a colaborar para que me realicen las entrevistas y pruebas necesarias. Comprendo que el fin de estas entrevistas y pruebas es única y exclusivamente para mi beneficio personal, por lo que he recibido información completa sobre las evaluaciones que se realizarán y he podido hacer todas las preguntas o dudas de mi interés, mismas que se han respondido satisfactoriamente.

II.- Consentimiento sobre tratamiento de datos personales: Respecto a los datos que proporcione, así como los datos resultantes de la aplicación de las entrevistas y evaluaciones, manifiesto por este medio y otorgo mi consentimiento expreso para:

     a) El tratamiento de mis datos personales.

     b) Para que el terapeuta o consultor me informe de los resultados de las entrevistas y pruebas realizadas a mi persona.

Así mismo manifiesto y estoy enterado(a) de que quedo en libertad de revocar el presente consentimiento, sabiendo que para dichos efectos es suficiente entregar una solicitud de revocación del consentimiento dirigida al consultor o terapeuta que me dio acceso a esta plataforma; o acudir personalmente a la oficina o consultor para redactar la revocación de mi consentimiento.`,
    requiereCheckbox: true,
    textoCheckbox: 'Manifiesto y otorgo mi Consentimiento Informado en los términos aquí expuestos.',
    esConsentimiento: true,
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [paso, setPaso] = useState(0)
  const [aceptadoGeneral, setAceptadoGeneral] = useState(false)
  const [aceptadoConsentimiento, setAceptadoConsentimiento] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const esUltimo = paso === pasos.length - 1
  const actual = pasos[paso]
  const esPasoImportante = paso === 3
  const esPasoConsentimiento = paso === 4

  const checkboxActual = esPasoConsentimiento ? aceptadoConsentimiento : aceptadoGeneral
  const puedeAvanzar = actual.requiereCheckbox ? checkboxActual : true

  function siguiente() {
    if (!puedeAvanzar || esUltimo) return
    setPaso(p => p + 1)
  }

  async function comenzar() {
    if (!aceptadoConsentimiento) return
    setGuardando(true)
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
      localStorage.setItem('avi_onboarding_done', '1')
      router.push('/patient/chat')
    }
  }

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
          <div className="text-center space-y-3">
            <div className="text-5xl">{actual.icono}</div>
            <h2 className="text-lg font-bold text-gray-800 leading-snug">{actual.titulo}</h2>
          </div>

          <p className={`text-gray-600 text-sm leading-relaxed whitespace-pre-line ${
            esPasoConsentimiento ? 'text-justify' : 'text-center'
          }`}>
            {actual.contenido}
          </p>

          {/* Checkbox */}
          {actual.requiereCheckbox && (
            <label className="flex items-start gap-3 bg-white border-2 border-primary-200 rounded-2xl px-4 py-4 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={esPasoConsentimiento ? aceptadoConsentimiento : aceptadoGeneral}
                onChange={e => {
                  if (esPasoConsentimiento) setAceptadoConsentimiento(e.target.checked)
                  else setAceptadoGeneral(e.target.checked)
                }}
                className="mt-0.5 accent-primary-600 w-5 h-5 flex-shrink-0"
              />
              <span className="text-sm text-gray-700 leading-relaxed font-medium">
                {actual.textoCheckbox}
              </span>
            </label>
          )}
        </div>

        {/* Botones */}
        <div className="px-6 pb-10 space-y-3">
          {esUltimo ? (
            <button
              onClick={comenzar}
              disabled={!aceptadoConsentimiento || guardando}
              className="w-full py-4 bg-primary-600 text-white font-semibold rounded-2xl
                         hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {guardando ? 'Guardando...' : 'Comenzar con AVI'}
            </button>
          ) : (
            <button
              onClick={siguiente}
              disabled={!puedeAvanzar}
              className="w-full py-4 bg-primary-600 text-white font-semibold rounded-2xl
                         hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          )}

          {paso > 0 && (
            <button
              onClick={() => setPaso(p => p - 1)}
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
