'use client'

// Avisos al paciente en su teléfono (28 oct 2026): notificación push cuando su terapeuta le manda un
// mensaje o un cuestionario, y el número de pendientes en el ícono de AVI (se quita al verlos).
//   - SincronizarAvisos (layout del paciente): pone el número del ícono al día al entrar, al cambiar de
//     pantalla y al leer un mensaje; si ya dio permiso, renueva su suscripción en silencio.
//   - ActivarAvisos (pantalla de inicio de Habla): pide el permiso una vez ("Ahora no" lo oculta 7 días).
//     En iPhone sin AVI en la pantalla de inicio explica cómo agregarla (sin eso iOS no da avisos).
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { pushDisponible, suscribirPush } from '@/lib/push/suscribir-navegador'

const API = '/api/patient/avisos'
const CLAVE_AHORA_NO = 'avi_avisos_ahora_no'
const DIAS_AHORA_NO = 7

async function ponerNumeroDelIcono(pendientes: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any
  try {
    if (pendientes > 0) await nav.setAppBadge?.(pendientes)
    else await nav.clearAppBadge?.()
  } catch { /* sin soporte */ }
  // Sin pendientes: se quitan los avisos que sigan en el teléfono (en Android el punto sale de ellos)
  if (pendientes === 0 && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const avisos = await reg?.getNotifications({ tag: 'avi-paciente' })
      avisos?.forEach(n => n.close())
    } catch { /* sin soporte */ }
  }
}

export default function SincronizarAvisos() {
  const pathname = usePathname()

  useEffect(() => {
    if (pushDisponible() && Notification.permission === 'granted') suscribirPush(API)
  }, [])

  useEffect(() => {
    const sincronizar = () => fetch(API)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) ponerNumeroDelIcono(j.pendientes ?? 0) })
      .catch(() => {})
    sincronizar()
    window.addEventListener('avi:mensajesLeidos', sincronizar)
    return () => window.removeEventListener('avi:mensajesLeidos', sincronizar)
  }, [pathname])

  return null
}

function esIphoneSinInstalar(): boolean {
  if (typeof window === 'undefined') return false
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instalada = (navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches
  return ios && !instalada
}

function dijoAhoraNo(): boolean {
  try {
    const t = Number(localStorage.getItem(CLAVE_AHORA_NO) ?? 0)
    return Date.now() - t < DIAS_AHORA_NO * 24 * 60 * 60 * 1000
  } catch { return false }
}

export function ActivarAvisos({ pro }: { pro: string }) {
  const [vista, setVista] = useState<'permiso' | 'iphone' | null>(null)
  const [activando, setActivando] = useState(false)

  useEffect(() => {
    if (dijoAhoraNo()) return
    if (pushDisponible()) { if (Notification.permission === 'default') setVista('permiso') }
    else if (esIphoneSinInstalar()) setVista('iphone')
  }, [])

  function ahoraNo() {
    try { localStorage.setItem(CLAVE_AHORA_NO, String(Date.now())) } catch { /* sin almacenamiento */ }
    setVista(null)
  }

  async function activar() {
    setActivando(true)
    const permiso = await Notification.requestPermission()
    if (permiso === 'granted') await suscribirPush(API)
    setActivando(false)
    setVista(null)
  }

  if (!vista) return null

  return (
    <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-left space-y-2">
      <p className="text-sm font-semibold text-gray-800">🔔 Avisos de tu {pro}</p>
      {vista === 'permiso' ? (
        <>
          <p className="text-xs text-gray-600 leading-relaxed">
            Activa los avisos para saber cuándo tu {pro} te envía un mensaje o un cuestionario. Verás el número en el ícono de AVI.
          </p>
          <div className="flex gap-2">
            <button
              onClick={activar}
              disabled={activando}
              className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {activando ? 'Activando…' : 'Activar avisos'}
            </button>
            <button onClick={ahoraNo} className="px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-amber-100 transition-colors">
              Ahora no
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-600 leading-relaxed">
            Para recibir avisos en tu iPhone, agrega AVI a tu pantalla de inicio desde Safari: Compartir → &quot;Agregar a pantalla de inicio&quot;, y ábrela desde ahí.
          </p>
          <div className="flex gap-2">
            <Link href="/install" className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold text-center transition-colors">
              Ver cómo
            </Link>
            <button onClick={ahoraNo} className="px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-amber-100 transition-colors">
              Ahora no
            </button>
          </div>
        </>
      )}
    </div>
  )
}
