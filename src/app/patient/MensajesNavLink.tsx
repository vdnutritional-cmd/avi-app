'use client'

// Pestaña "Mensajes" de la barra del paciente, con el número de mensajes sin leer.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function MensajesNavLink() {
  const pathname = usePathname()
  const [noLeidos, setNoLeidos] = useState(0)

  useEffect(() => {
    const cargar = () => fetch('/api/patient/mensajes')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) setNoLeidos(j.noLeidos ?? 0) })
      .catch(() => {})
    cargar()
    window.addEventListener('avi:mensajesLeidos', cargar)
    return () => window.removeEventListener('avi:mensajesLeidos', cargar)
  }, [pathname])

  return (
    <Link href="/patient/mensajes" className="relative flex flex-col items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors">
      <span className="text-xl">✉️</span>
      <span>Mensajes</span>
      {noLeidos > 0 && (
        <span className="absolute -top-1 right-0 translate-x-1/2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {noLeidos}
        </span>
      )}
    </Link>
  )
}
