'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TIMEOUT_MS  = Number(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS ?? 900_000)  // 15 min
const WARNING_MS  = TIMEOUT_MS - 60_000  // Aviso 1 min antes (t=14 min)
const EVENTS      = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const

/**
 * NOM-024 — Timeout de inactividad para el panel del terapeuta.
 *
 * Flujo correcto:
 *   t=0 de inactividad → inicia timer
 *   t=14 min sin actividad → muestra aviso (onWarn)
 *   Cualquier actividad durante el aviso → resetea todo (onDismiss) y reinicia timer
 *   t=15 min sin actividad (60 seg tras aviso) → cierra sesión y redirige con ?reason=inactivity
 *
 * Diseño:
 *   - Un solo timer (warning). Al dispararse, arranca el countdown final de 60 s.
 *     Esto garantiza exactamente 1 min entre aviso y logout, sin timers paralelos.
 *   - handleActivity SIEMPRE resetea (antes Y después del aviso), para que
 *     "Seguir trabajando" o cualquier interacción realmente cancele el logout.
 *   - Callbacks en refs → no son dependencias de useCallback/useEffect → el
 *     useEffect principal corre solo una vez (no se reinicia por re-renders del padre).
 *   - Page Visibility API: al despertar dispositivo verifica tiempo real con Date.now().
 */
export function useInactivityTimer(opts?: {
  onWarn?:    () => void   // mostrar modal de advertencia
  onDismiss?: () => void   // ocultar modal (usuario siguió activo)
  onSignOut?: () => void   // sesión cerrada
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

    // Si el aviso estaba visible, descartarlo
    if (wasWarning) onDismissRef.current?.()

    // Un solo timer: aviso a los 14 min de inactividad
    warningRef.current = setTimeout(() => {
      if (!warnedRef.current) {
        warnedRef.current = true
        onWarnRef.current?.()

        // Desde el aviso, exactamente 60 s para cerrar sesión
        logoutAtRef.current = Date.now() + 60_000
        logoutRef.current = setTimeout(() => {
          signOut()
        }, 60_000)
      }
    }, WARNING_MS)
  }, [clearTimers, signOut])

  useEffect(() => {
    resetTimers()

    // Cualquier actividad reinicia el timer — SIEMPRE, incluso si el aviso estaba visible
    const handleActivity = () => resetTimers()

    // Fix móvil: al regresar al frente, verificar si ya expiró el tiempo real
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
