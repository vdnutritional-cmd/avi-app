'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl
                 text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
    >
      <span>🚪</span>
      <span>Cerrar sesión</span>
    </button>
  )
}
