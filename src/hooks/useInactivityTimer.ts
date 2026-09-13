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
 * BUG FIX: los callbacks onWarn/onSignOut se guardan en refs para que los
 * cambios de referencia (causados por re-renders del componente padre) no
 * recreen signOut/resetTimers ni re-ejecuten el useEffect, lo que reiniciaba
 * los timers al aparecer el modal de advertencia.
 *
 * FIX MÓVIL: Page Visibility API verifica el tiempo real transcurrido con
 * Date.now() al regresar al frente, por si el browser throttleó los timers.
 *
 * Uso: llamar en InactivityGuard o therapist/layout.tsx
 *   useInactivityTimer({ onWarn, onSignOut })
 */
export function useInactivityTimer(opts?: {
  onWarn?: () => void
  onSignOut?: () => void
}) {
  const router = useRouter()

  // Refs para callbacks: se actualizan en cada render sin ser dependencias
  // de useCallback/useEffect, evitando que re-renders reinicien los timers.
  const onWarnRef    = useRef(opts?.onWarn)
  const onSignOutRef = useRef(opts?.onSignOut)
  useEffect(() => {
    onWarnRef.current    = opts?.onWarn
    onSignOutRef.current = opts?.onSignOut
  })

  const warningRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnedRef    = useRef(false)
  const warningAtRef = useRef<number | null>(null)
  const logoutAtRef  = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (warningRef.current) clearTimeout(warningRef.current)
    if (logoutRef.current)  clearTimeout(logoutRef.current)
  }, [])  // estable — sin dependencias externas

  const signOut = useCallback(async () => {
    clearTimers()
    const supabase = createClient()
    await supabase.auth.signOut()
    onSignOutRef.current?.()  // usa ref, no opts directo
    router.push('/auth/login?reason=inactivity')
  }, [clearTimers, router])  // estable — no depende de opts

  const resetTimers = useCallback(() => {
    clearTimers()
    warnedRef.current = false

    const now = Date.now()
    warningAtRef.current = now + WARNING_MS
    logoutAtRef.current  = now + TIMEOUT_MS

    warningRef.current = setTimeout(() => {
      if (!warnedRef.current) {
        warnedRef.current = true
        onWarnRef.current?.()  // usa ref, no opts directo
      }
    }, WARNING_MS)

    logoutRef.current = setTimeout(() => {
      signOut()
    }, TIMEOUT_MS)
  }, [clearTimers, signOut])  // estable — no depende de opts

  useEffect(() => {
    resetTimers()

    const handleActivity = () => {
      if (!warnedRef.current) resetTimers()
    }

    // Fix móvil: browsers pausan setTimeout cuando el tab va a segundo plano.
    // Al regresar al frente, comparamos tiempo real y cerramos si ya expiró.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (logoutAtRef.current && now >= logoutAtRef.current) {
        signOut()
      } else if (warningAtRef.current && now >= warningAtRef.current && !warnedRef.current) {
        warnedRef.current = true
        onWarnRef.current?.()
      }
    }

    EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }))
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimers()
      EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [resetTimers, clearTimers, signOut])  // ahora todos son estables → effect corre solo 1 vez
}
