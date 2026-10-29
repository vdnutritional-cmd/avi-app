'use client'

import { useEffect, useState } from 'react'
import { suscribirPush } from '@/lib/push/suscribir-navegador'

export default function PushRegistrar() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator)
    ) return

    setPermission(Notification.permission)

    // Si ya tiene permiso, registrar silenciosamente
    if (Notification.permission === 'granted') {
      registerAndSubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function registerAndSubscribe() {
    return suscribirPush('/api/push/subscribe')
  }

  async function handleEnable() {
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') await registerAndSubscribe()
  }

  // Solo mostrar el banner si el permiso aún no ha sido decidido
  if (permission !== 'default') return null

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-amber-200 shadow-lg rounded-xl p-4 max-w-xs z-50">
      <p className="text-sm font-semibold text-gray-800 mb-1">🔔 Alertas de crisis</p>
      <p className="text-xs text-gray-500 mb-3">
        Activa las notificaciones para recibir alertas inmediatas cuando un paciente está en crisis.
      </p>
      <button
        onClick={handleEnable}
        className="bg-purple-700 text-white text-xs px-4 py-2 rounded-lg hover:bg-purple-800 transition-colors w-full font-medium"
      >
        Activar notificaciones
      </button>
    </div>
  )
}
