'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TIMEOUT_MS  = Number(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS ?? 900_000)  // 15 min
const WARNING_MS  = TIMEOUT_MS - 60_000  // Aviso a los 14 min
const EVENTS      = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const

/**
 * NOM-024 — Timeout de inactividad para el panel del terapeuta.
 *
 * Flujo:
 *   - t=0 se cuenta desde el último momento de actividad del usuario
 *   - Cualquier evento (mouse, teclado, toque, scroll) reinicia t=0
 *   - t=14 min sin actividad → muestra aviso (onWarn)
 *   - Actividad durante el aviso → reinicia timer y descarta el modal (onDismiss)
 *   - t=15 min sin actividad → cierra sesión → /auth/login?reason=inactivity
 *
 * Implementación: dos timers paralelos (warning y logout).
 * Los callbacks se guardan en refs para que no sean dependencias de useCallback,
 * manteniendo signOut y resetTimers estables entre re-renders del componente padre.
 * Fix móvil: Page Visibility API verifica tiempo real con Date.now() al regresar al frente.
 */
export function useInactivityTimer(opts?: {
  onWarn?:    () => void
  onDismiss?: () => void
  onSignOut?: () => void
}) {
  const router = useRouter()

  // Refs para callbacks — actualizados en render, sin ser dependencias de hooks
  const onWarnRef    = useRef(opts?.onWarn)
  const onDismissRef = useRef(opts?.onDismiss)
  const onSignOutRef = useRef(opts?.onSignOut)
  onWarnRef.current    = opts?.onWarn
  onDismissRef.current = opts?.onDismiss
  onSignOutRef.current = opts?.onSignOut

  const warningRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnedRef   = useRef(false)
  const logoutAtRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (warningRef.current) clearTimeout(warningRef.current)
    if (logoutRef.current)  clearTimeout(logoutRef.current)
    logoutAtRef.current = null
  }, [])

  const signOut = useCallback(async () => {
    clearTimers()
    const supabase = createClient()
    await supabase.auth.signOut()
    onSignOutRef.current?.()
    router.push('/auth/login?reason=inactivity')
  }, [clearTimers, router])

  const resetTimers = useCallback(() => {
    const wasWarning = warnedRef.current
    clearTimers()
    warnedRef.current = false

    // Si el modal estaba visible, descartarlo
    if (wasWarning) onDismissRef.current?.()

    // Dos timers paralelos: aviso a los 14 min, logout a los 15 min
    warningRef.current = setTimeout(() => {
      if (!warnedRef.current) {
        warnedRef.current = true
        onWarnRef.current?.()
      }
    }, WARNING_MS)

    logoutAtRef.current = Date.now() + TIMEOUT_MS
    logoutRef.current = setTimeout(() => {
      signOut()
    }, TIMEOUT_MS)
  }, [clearTimers, signOut])

  useEffect(() => {
    resetTimers()

    // Cualquier actividad reinicia t=0, incluso si el aviso ya está visible
    const handleActivity = () => resetTimers()

    // Fix móvil: al regresar al frente, verificar tiempo real transcurrido
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (logoutAtRef.current && Date.now() >= logoutAtRef.current) {
        signOut()
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
