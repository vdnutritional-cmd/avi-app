'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Página de entrada para la app nativa (AVI-TCA).
 * Recibe access_token y refresh_token en el hash de la URL,
 * establece la sesión de Supabase y redirige al panel del terapeuta.
 *
 * Ejemplo de URL:
 *   https://go.avi-app.com.mx/auth/mobile#access_token=XXX&refresh_token=YYY
 */
export default function MobileAuthPage() {
  const router = useRouter()

  useEffect(() => {
    async function handleTokens() {
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')

      if (!access_token || !refresh_token) {
        // Sin tokens → ir al login normal
        router.replace('/auth/login')
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.setSession({ access_token, refresh_token })

      if (error) {
        router.replace('/auth/login')
        return
      }

      // Sesión establecida → ir al panel del terapeuta
      router.replace('/therapist/patients')
    }

    handleTokens()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-violet-600">
      <div className="text-center text-white">
        <p className="text-4xl font-black mb-2">AVI</p>
        <p className="text-sm opacity-75">Abriendo tu panel…</p>
      </div>
    </div>
  )
}
