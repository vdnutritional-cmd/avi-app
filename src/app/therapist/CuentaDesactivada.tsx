'use client'

// Pantalla para un terapeuta desactivado por Administración AVI (profiles.is_active=false)
// que todavía tenía una sesión abierta. El login ya no le deja entrar.
export default function CuentaDesactivada({ therapistName }: { therapistName: string }) {
  async function salir() {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* silencioso */ }
    window.location.href = '/auth/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-6 text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <h1 className="text-lg font-bold text-gray-800">Cuenta desactivada</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          {therapistName ? `${therapistName}, tu` : 'Tu'} cuenta de terapeuta en AVI está desactivada.
          Si crees que es un error, contacta a AVI por WhatsApp al 33 1883 0312.
        </p>
        <button
          onClick={salir}
          className="w-full text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl py-2.5 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
