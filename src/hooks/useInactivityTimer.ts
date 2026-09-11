'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TIMEOUT_MS     = Number(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS ?? 900_000)  // 15 min
const WARNING_MS     = TIMEOUT_MS - 60_000  // Aviso 1 min antes
const EVENTS         = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const

/**
 * NOM-024 — Timeout de inactividad para el panel del terapeuta.
 * Muestra advertencia a los 14 min, cierra sesión a los 15 min.
 *
 * Uso: llamar en therapist/layout.tsx
 *   useInactivityTimer({ onWarn, onSignOut })
 */
export function useInactivityTimer(opts?: {
  onWarn?: () => void
  onSignOut?: () => void
}) {
  const router      = useRouter()
  const warningRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnedRef   = useRef(false)

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

    EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }))

    return () => {
      clearTimers()
      EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity))
    }
  }, [resetTimers, clearTimers])
}
