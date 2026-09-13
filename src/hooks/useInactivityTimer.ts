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
 * Los callbacks onWarn/onSignOut se guardan en refs actualizados directamente
 * en cada render (patrón React recomendado). Esto evita que signOut/resetTimers
 * dependan de opts, manteniéndolos estables entre renders y evitando que el
 * useEffect principal se re-ejecute y reinicie los timers al aparecer el modal.
 *
 * Fix móvil: Page Visibility API verifica tiempo real con Date.now() al
 * regresar al frente, por si el browser throttleó los timers.
 */
export function useInactivityTimer(opts?: {
  onWarn?: () => void
  onSignOut?: () => void
}) {
  const router = useRouter()

  // Actualizar refs directamente en render (seguro para refs, sin effect).
  // Esto garantiza que los callbacks estén actualizados antes de que
  // cualquier effect corra, sin agregar opts como dependencia.
  const onWarnRef    = useRef(opts?.onWarn)
  const onSignOutRef = useRef(opts?.onSignOut)
  onWarnRef.current    = opts?.onWarn
  onSignOutRef.current = opts?.onSignOut

  const warningRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnedRef    = useRef(false)
  const warningAtRef = useRef<number | null>(null)
  const logoutAtRef  = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (warningRef.current) clearTimeout(warningRef.current)
    if (logoutRef.current)  clearTimeout(logoutRef.current)
  }, [])

  const signOut = useCallback(async () => {
    clearTimers()
    const supabase = createClient()
    await supabase.auth.signOut()
    onSignOutRef.current?.()
    router.push('/auth/login?reason=inactivity')
  }, [clearTimers, router])

  const resetTimers = useCallback(() => {
    clearTimers()
    warnedRef.current = false

    const now = Date.now()
    warningAtRef.current = now + WARNING_MS
    logoutAtRef.current  = now + TIMEOUT_MS

    warningRef.current = setTimeout(() => {
      if (!warnedRef.current) {
        warnedRef.current = true
        onWarnRef.current?.()
      }
    }, WARNING_MS)

    logoutRef.current = setTimeout(() => {
      signOut()
    }, TIMEOUT_MS)
  }, [clearTimers, signOut])

  useEffect(() => {
    resetTimers()

    const handleActivity = () => {
      if (!warnedRef.current) resetTimers()
    }

    // Fix móvil: browsers pausan setTimeout cuando el tab va a segundo plano.
    // Al regresar al frente, verificamos tiempo real y actuamos si ya expiró.
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
  }, [resetTimers, clearTimers, signOut])
}
