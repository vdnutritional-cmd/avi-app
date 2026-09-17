import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente Supabase para el servidor (Server Components, API Routes, Server Actions).
 * Maneja cookies automáticamente para mantener la sesión.
 *
 * Variables de entorno requeridas en Vercel (Settings → Environment Variables):
 *   SUPABASE_URL      — URL del proyecto (mismo valor que NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_ANON_KEY — clave anon/pública del proyecto (mismo valor que NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *
 * Nota: se usan vars sin prefijo NEXT_PUBLIC_ porque en Next.js 16 con Turbopack
 * las variables NEXT_PUBLIC_ no están disponibles en process.env en API Routes
 * en runtime (solo se embeben en el bundle del cliente en build time).
 */
export async function createClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      `Supabase server client: variables de entorno faltantes en Vercel. ` +
      `SUPABASE_URL: ${!!supabaseUrl}, SUPABASE_ANON_KEY: ${!!supabaseAnonKey}. ` +
      `Agregar en Settings → Environment Variables.`
    )
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // En Server Components de solo lectura este error es esperado e ignorable.
        }
      },
    },
  })
}
