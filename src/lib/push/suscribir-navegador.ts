// Suscribe este navegador a las notificaciones push de AVI y la guarda en el servidor. Solo navegador.
// La usan PushRegistrar (terapeuta: crisis) y AvisosPush (paciente: mensajes y cuestionarios).
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function pushDisponible(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function suscribirPush(api: string) {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const existing = await registration.pushManager.getSubscription()
    const sub = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
    })

    await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
  } catch (err) {
    console.error('Error registrando push:', err)
  }
}
