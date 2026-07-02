'use client'

import { useEffect, useState } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

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

  async function registerAndSubscribe() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const existing = await registration.pushManager.getSubscription()
      const sub = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
    } catch (err) {
      console.error('Error registrando push:', err)
    }
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
