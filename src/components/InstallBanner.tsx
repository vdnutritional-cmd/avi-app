'use client'

import { useEffect, useState } from 'react'

type Platform = 'android' | 'ios' | null

export default function InstallBanner() {
  const [platform, setPlatform] = useState<Platform>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<unknown>(null)
  const [showModal, setShowModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const isStandalone =
      (window.navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    if (isStandalone) return // ya instalada

    const ua = navigator.userAgent
    // iOS Safari — excluir Chrome en iOS (CriOS)
    if (/iPhone|iPad|iPod/.test(ua) && !/CriOS/.test(ua)) {
      setPlatform('ios')
    }

    // Android — Chrome dispara beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setPlatform('android')
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleAndroidInstall() {
    if (!deferredPrompt) return
    const prompt = deferredPrompt as {
      prompt: () => void
      userChoice: Promise<{ outcome: string }>
    }
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setDismissed(true)
    setDeferredPrompt(null)
  }

  if (dismissed || !platform) return null

  return (
    <>
      {/* ── Banner flotante ── */}
      <div className="fixed bottom-4 left-4 right-4 z-50">
        <div className="bg-white border border-purple-200 rounded-2xl shadow-xl p-4 flex items-center gap-3 max-w-md mx-auto">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-purple-100 flex items-center justify-center text-xl">
            📱
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              {platform === 'android' ? 'Instala AVI en tu Android' : 'Instala AVI en tu iPhone'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Ábrela con un toque desde tu pantalla de inicio
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDismissed(true)}
              aria-label="Cerrar"
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl transition-colors"
            >
              ×
            </button>
            <button
              onClick={platform === 'android' ? handleAndroidInstall : () => setShowModal(true)}
              className="bg-purple-700 hover:bg-purple-800 text-white text-xs px-4 py-2 rounded-xl font-semibold transition-colors whitespace-nowrap"
            >
              {platform === 'android' ? 'Instalar' : 'Ver pasos'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal iOS ── */}
      {showModal && platform === 'ios' && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-800">Instalar AVI en iPhone</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl transition-colors"
                >
                  ×
                </button>
              </div>

              <IOSStep n={1} text={
                <>Asegúrate de estar en <strong>Safari</strong> — no en Chrome ni otro navegador</>
              }>
                <SafariBarSVG />
              </IOSStep>

              <IOSStep n={2} text={
                <>Toca el ícono de <strong>Compartir</strong> — cuadro con flecha hacia arriba{' '}
                <ShareInlineSVG /></>
              }>
                <ShareButtonSVG />
              </IOSStep>

              <IOSStep n={3} text={
                <>Desliza el menú hacia abajo y toca <strong>&ldquo;Agregar a pantalla de inicio&rdquo;</strong></>
              }>
                <AddToHomeSVG />
              </IOSStep>

              <IOSStep n={4} text={
                <>Toca <strong>&ldquo;Agregar&rdquo;</strong> en la esquina superior derecha del cuadro que aparece</>
              }>
                <ConfirmSVG />
              </IOSStep>

              <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
                <strong>Nota:</strong> El botón Compartir puede estar en la{' '}
                <strong>barra inferior</strong> o en la <strong>esquina superior derecha</strong>{' '}
                de Safari, según tus ajustes.
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl font-semibold transition-colors text-sm"
              >
                ¡Entendido!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Sub-componentes internos ─────────────────────────────── */

function IOSStep({ n, text, children }: {
  n: number
  text: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-3 items-start">
        <span className="shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center mt-0.5">
          {n}
        </span>
        <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
      </div>
      <div className="ml-9 bg-gray-50 rounded-xl p-3 flex justify-center">
        {children}
      </div>
    </div>
  )
}

/** Ícono de compartir inline (para usar en texto) */
function ShareInlineSVG() {
  return (
    <span className="inline-flex items-center justify-center mx-0.5 w-5 h-5 bg-gray-200 rounded align-middle">
      <svg viewBox="0 0 14 16" className="w-3 h-3" fill="none">
        <rect x="1" y="5" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <line x1="7" y1="5" x2="7" y2="0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M 4 3 L 7 0 L 10 3" fill="none" stroke="currentColor" strokeWidth="1.4"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/* ── Ilustraciones SVG ────────────────────────────────────── */

/** Paso 1: barra de dirección de Safari con URL */
export function SafariBarSVG() {
  return (
    <svg viewBox="0 0 240 50" className="w-full max-w-[240px]" fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="50" rx="10" fill="#f9fafb" stroke="#e5e7eb" />
      {/* barra de URL */}
      <rect x="8" y="11" width="224" height="28" rx="8" fill="white" stroke="#d1d5db" />
      {/* candado */}
      <rect x="16" y="20" width="7" height="8" rx="1.5" fill="none" stroke="#6b7280" strokeWidth="1.2" />
      <path d="M 17.5 20 C 17.5 17 22.5 17 22.5 20" fill="none" stroke="#6b7280" strokeWidth="1.2" />
      {/* URL */}
      <text x="30" y="29" fontSize="11" fill="#7c3aed" fontFamily="monospace">
        avi-app.com.mx
      </text>
      {/* ícono Safari (brújula) */}
      <circle cx="220" cy="25" r="9" fill="none" stroke="#007AFF" strokeWidth="1.2" />
      <path d="M 217 21 L 221 25 L 217 29" fill="none" stroke="#007AFF" strokeWidth="1.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Paso 2: barra inferior de Safari con botón Compartir destacado */
export function ShareButtonSVG() {
  return (
    <svg viewBox="0 0 280 76" className="w-full max-w-[280px]" fill="none"
      xmlns="http://www.w3.org/2000/svg">
      {/* fondo barra */}
      <rect width="280" height="76" rx="10" fill="#f3f4f6" stroke="#e5e7eb" />
      {/* botón atrás */}
      <path d="M 22 38 L 13 38" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" />
      <path d="M 18 33 L 12 38 L 18 43" stroke="#007AFF" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* botón adelante (gris) */}
      <path d="M 48 38 L 57 38" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" />
      <path d="M 52 33 L 58 38 L 52 43" stroke="#d1d5db" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* botón COMPARTIR — destacado */}
      <rect x="113" y="14" width="44" height="44" rx="10" fill="#7c3aed" />
      {/* caja */}
      <rect x="124" y="30" width="22" height="17" rx="3" fill="none" stroke="white" strokeWidth="1.8" />
      {/* flecha arriba */}
      <line x1="135" y1="29" x2="135" y2="19" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 130 24 L 135 19 L 140 24" fill="none" stroke="white" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* anillo parpadeante */}
      <rect x="109" y="10" width="52" height="52" rx="13" stroke="#a855f7" strokeWidth="2"
        strokeDasharray="5 3" fill="none" opacity="0.7" />
      {/* etiqueta */}
      <text x="135" y="70" fontSize="9" fill="#7c3aed" textAnchor="middle" fontWeight="700">
        Compartir
      </text>
      {/* marcador */}
      <path d="M 210 26 L 210 52 L 220 46 L 230 52 L 230 26 Z" fill="none"
        stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />
      {/* pestañas */}
      <rect x="255" y="29" width="18" height="14" rx="3" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
      <text x="264" y="39" fontSize="8" fill="#9ca3af" textAnchor="middle">2</text>
    </svg>
  )
}

/** Paso 3: menú de compartir con "Agregar a pantalla de inicio" */
export function AddToHomeSVG() {
  return (
    <svg viewBox="0 0 260 138" className="w-full max-w-[260px]" fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <rect width="260" height="138" rx="12" fill="white" stroke="#e5e7eb" />
      {/* opción 1: Copiar enlace */}
      <rect x="8" y="8" width="244" height="42" rx="8" fill="#f9fafb" />
      <rect x="16" y="19" width="22" height="20" rx="5" fill="#e5e7eb" />
      <rect x="19" y="23" width="10" height="11" rx="2" fill="none" stroke="#9ca3af" strokeWidth="1.2" />
      <rect x="23" y="20" width="10" height="11" rx="2" fill="none" stroke="#9ca3af" strokeWidth="1.2" />
      <text x="48" y="33" fontSize="11" fill="#6b7280">Copiar enlace</text>
      {/* opción 2: Agregar — DESTACADA */}
      <rect x="8" y="58" width="244" height="54" rx="8" fill="#f0fdf4" stroke="#22c55e" strokeWidth="1.5" />
      <rect x="16" y="68" width="26" height="26" rx="7" fill="#22c55e" />
      <line x1="29" y1="74" x2="29" y2="86" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="23" y1="80" x2="35" y2="80" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <text x="52" y="80" fontSize="11" fill="#15803d" fontWeight="600">Agregar a pantalla</text>
      <text x="52" y="96" fontSize="11" fill="#15803d" fontWeight="600">de inicio</text>
      <text x="234" y="94" fontSize="18" textAnchor="middle">👆</text>
      {/* opción 3: difuminada */}
      <rect x="8" y="120" width="244" height="12" rx="6" fill="#f9fafb" opacity="0.6" />
      <text x="48" y="130" fontSize="10" fill="#d1d5db">Agregar a marcadores</text>
    </svg>
  )
}

/** Paso 4: diálogo de confirmación con botón Agregar */
export function ConfirmSVG() {
  return (
    <svg viewBox="0 0 260 90" className="w-full max-w-[260px]" fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <rect width="260" height="90" rx="12" fill="white" stroke="#e5e7eb" />
      {/* barra superior */}
      <rect width="260" height="50" rx="12" fill="#f9fafb" />
      <rect y="38" width="260" height="12" fill="#f9fafb" />
      <line x1="0" y1="50" x2="260" y2="50" stroke="#e5e7eb" />
      {/* Cancelar */}
      <text x="14" y="30" fontSize="13" fill="#007AFF">Cancelar</text>
      {/* Título */}
      <text x="130" y="22" fontSize="10" fill="#9ca3af" textAnchor="middle">Nueva app</text>
      <text x="130" y="36" fontSize="11" fill="#374151" textAnchor="middle" fontWeight="600">
        Pantalla de inicio
      </text>
      {/* botón AGREGAR */}
      <rect x="193" y="15" width="56" height="26" rx="8" fill="#007AFF" />
      <text x="221" y="31" fontSize="12" fill="white" textAnchor="middle" fontWeight="700">
        Agregar
      </text>
      {/* campo nombre */}
      <rect x="10" y="58" width="240" height="24" rx="6" fill="white" stroke="#d1d5db" />
      <text x="20" y="74" fontSize="12" fill="#374151">AVI</text>
    </svg>
  )
}
