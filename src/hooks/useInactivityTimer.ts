'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TIMEOUT_MS  = Number(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS ?? 900_000)  // 15 min
const WARNING_MS  = TIMEOUT_MS - 60_000  // Aviso 1 min antes
const EVENTS      = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const

/**
 * NOM-024 — Timeout de inactividad para el panel del terapeuta.
 * Muestra advertencia a los 14 min, cierra sesión a los 15 min.
 *
 * Fix móvil: los setTimeout se pausan cuando el browser va a segundo plano.
 * Se usa Page Visibility API para verificar el tiempo real transcurrido con
 * Date.now() al regresar al frente, y cerrar sesión si ya expiró.
 *
 * Uso: llamar en therapist/layout.tsx
 *   useInactivityTimer({ onWarn, onSignOut })
 */
export function useInactivityTimer(opts?: {
  onWarn?: () => void
  onSignOut?: () => void
}) {
  const router       = useRouter()
  const warningRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnedRef    = useRef(false)
  const warningAtRef = useRef<number | null>(null)  // timestamp absoluto del warning
  const logoutAtRef  = useRef<number | null>(null)  // timestamp absoluto del logout

  const clearTimers = useCallback(() => {
    if (warningRef.current) clearTimeout(warningRef.current)
    if (logoutRef.current)  clearTimeout(logoutRef.current)
  }, [])

  const signOut = useCallback(async () => {
    clearTimers()
    const supabase = createClient()
    await supabase.auth.signOut()
    opts?.onSignOut?.()
    router.push('/auth/login?reason=inactivity')
  }, [clearTimers, opts, router])

  const resetTimers = useCallback(() => {
    clearTimers()
    warnedRef.current = false

    const now = Date.now()
    warningAtRef.current = now + WARNING_MS
    logoutAtRef.current  = now + TIMEOUT_MS

    warningRef.current = setTimeout(() => {
      if (!warnedRef.current) {
        warnedRef.current = true
        opts?.onWarn?.()
      }
    }, WARNING_MS)

    logoutRef.current = setTimeout(() => {
      signOut()
    }, TIMEOUT_MS)
  }, [clearTimers, opts, signOut])

  useEffect(() => {
    resetTimers()

    const handleActivity = () => {
      // Solo reinicia si no está en la ventana de advertencia final
      if (!warnedRef.current) resetTimers()
    }

    // Fix para móvil: los setTimeout se congelan cuando el tab va a segundo plano.
    // Al regresar al frente, comparamos el tiempo real transcurrido.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return

      const now = Date.now()

      // ¿Ya debió haber cerrado sesión?
      if (logoutAtRef.current && now >= logoutAtRef.current) {
        signOut()
        return
      }

      // ¿Ya debió haber mostrado el aviso?
      if (warningAtRef.current && now >= warningAtRef.current && !warnedRef.current) {
        warnedRef.current = true
        opts?.onWarn?.()
      }
    }

    EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }))
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimers()
      EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [resetTimers, clearTimers, signOut, opts])
}
