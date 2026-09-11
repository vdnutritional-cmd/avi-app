'use client'

import { useState } from 'react'
import { useInactivityTimer } from '@/hooks/useInactivityTimer'

/**
 * Componente que envuelve el layout del terapeuta.
 * Muestra modal de advertencia de inactividad y cierra sesión automáticamente.
 *
 * Uso en therapist/layout.tsx:
 *   <InactivityGuard>{children}</InactivityGuard>
 */
export default function InactivityGuard({ children }: { children: React.ReactNode }) {
  const [warning, setWarning] = useState(false)

  useInactivityTimer({
    onWarn:    () => setWarning(true),
    onSignOut: () => setWarning(false),
  })

  return (
    <>
      {children}

      {warning && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="inactivity-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-4xl mb-4">⏱</div>
            <h2
              id="inactivity-title"
              className="text-xl font-bold text-gray-800 mb-3"
            >
              Sesión a punto de cerrar
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              Por seguridad y cumplimiento con la NOM-024, tu sesión se cerrará
              en <strong>1 minuto</strong> por inactividad. Mueve el mouse o
              presiona cualquier tecla para continuar.
            </p>
            <button
              onClick={() => setWarning(false)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white
                         font-semibold rounded-xl transition-colors"
            >
              Seguir trabajando
            </button>
          </div>
        </div>
      )}
    </>
  )
}
