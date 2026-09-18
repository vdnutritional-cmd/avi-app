'use client'

import { useState } from 'react'

interface Props {
  therapistName: string
  token: string
}

const BASE_URL = 'https://avi-app.com.mx'

export default function MiQRClient({ therapistName, token }: Props) {
  const registroUrl = `${BASE_URL}/registro-consultorio?t=${token}`
  const qrImageUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(registroUrl)}`

  const [copiado, setCopiado] = useState(false)

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(registroUrl)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      alert('No se pudo copiar. Copia manualmente:\n' + registroUrl)
    }
  }

  function descargarQR() {
    // Abre la imagen del QR en una pestaña nueva para que el terapeuta la guarde o imprima
    window.open(qrImageUrl, '_blank')
  }

  function compartirWhatsApp() {
    const texto = encodeURIComponent(
      `Hola, te comparto el enlace para registrarte en AVI y quedar vinculado a mi consulta:\n${registroUrl}`
    )
    window.open(`https://wa.me/?text=${texto}`, '_blank')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-8">

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mi código QR de registro</h1>
        <p className="text-gray-500 text-sm mt-1">
          Muéstrale este QR a tus pacientes para que se registren en AVI vinculados a tu consulta.
        </p>
      </div>

      {/* QR */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrImageUrl}
          alt="QR de registro"
          width={240}
          height={240}
          className="rounded-2xl"
        />
        <div className="text-center">
          <p className="font-semibold text-gray-800 text-sm">{therapistName}</p>
          <p className="text-xs text-gray-400 mt-0.5">AVI · Registro de pacientes</p>
        </div>
      </div>

      {/* Instrucciones */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4 space-y-2">
        <p className="text-sm font-semibold text-indigo-800">¿Cómo usarlo?</p>
        <ol className="text-sm text-indigo-700 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Muestra este QR a tu paciente desde tu teléfono o imprímelo.</li>
          <li>El paciente lo escanea con la cámara de su teléfono.</li>
          <li>Llena el formulario y su cuenta queda vinculada automáticamente a ti.</li>
          <li>También puedes enviarle el enlace directo por WhatsApp.</li>
        </ol>
      </div>

      {/* Acciones */}
      <div className="space-y-3">
        <button
          onClick={descargarQR}
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold
                     rounded-2xl transition-colors text-sm flex items-center justify-center gap-2"
        >
          ⬇️ Ver / descargar QR
        </button>

        <button
          onClick={compartirWhatsApp}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold
                     rounded-2xl transition-colors text-sm flex items-center justify-center gap-2"
        >
          💬 Compartir por WhatsApp
        </button>

        <button
          onClick={copiarLink}
          className="w-full py-3 border-2 border-gray-200 hover:border-primary-300 text-gray-700
                     font-semibold rounded-2xl transition-colors text-sm flex items-center justify-center gap-2"
        >
          {copiado ? '✓ Enlace copiado' : '🔗 Copiar enlace'}
        </button>
      </div>

      {/* Link visible */}
      <div className="bg-gray-50 rounded-xl px-4 py-3">
        <p className="text-xs text-gray-400 mb-1">Enlace de registro</p>
        <p className="text-xs text-gray-600 break-all font-mono leading-relaxed">{registroUrl}</p>
      </div>

      <p className="text-xs text-gray-400 text-center leading-relaxed">
        Este código es único para tu consulta. No lo compartas con personas que no sean tus pacientes.
      </p>
    </div>
  )
}
