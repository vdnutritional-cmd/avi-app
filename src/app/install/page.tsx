import Link from 'next/link'

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4 py-10">
      <div className="max-w-md mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="text-3xl font-bold text-primary-700">AVI</Link>
          <h1 className="text-xl font-semibold text-gray-800">Instala AVI en tu celular</h1>
          <p className="text-sm text-gray-500">
            AVI funciona como una app nativa. Agrégala a tu pantalla de inicio
            para abrirla con un solo toque, sin necesidad de buscarla en el navegador.
          </p>
        </div>

        {/* iPhone / Safari */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍎</span>
            <div>
              <h2 className="font-semibold text-gray-800">iPhone (Safari)</h2>
              <p className="text-xs text-gray-400">iOS 16.4 o superior recomendado</p>
            </div>
          </div>

          <ol className="space-y-3 text-sm text-gray-700">
            <Step number={1}>
              Abre <strong>Safari</strong> y entra a{' '}
              <span className="font-mono text-primary-700 text-xs">avi-app.com.mx</span>
            </Step>
            <Step number={2}>
              Toca el botón de <strong>compartir</strong>{' '}
              <span className="inline-block bg-gray-100 rounded px-2 py-0.5 text-xs">⬆</span>{' '}
              que aparece en la barra inferior del navegador
            </Step>
            <Step number={3}>
              Desliza hacia abajo en el menú y toca{' '}
              <strong>"Agregar a pantalla de inicio"</strong>
            </Step>
            <Step number={4}>
              Escribe <strong>"AVI"</strong> como nombre (o deja el que aparece) y toca{' '}
              <strong>"Agregar"</strong>
            </Step>
            <Step number={5}>
              ¡Listo! El ícono de AVI aparecerá en tu pantalla de inicio como cualquier otra app.
            </Step>
          </ol>

          <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-700">
            ⚠️ Solo funciona desde <strong>Safari</strong>. Chrome en iPhone no permite instalar apps.
          </div>
        </div>

        {/* Android / Chrome */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🤖</span>
            <div>
              <h2 className="font-semibold text-gray-800">Android (Chrome)</h2>
              <p className="text-xs text-gray-400">Compatible con la mayoría de dispositivos Android</p>
            </div>
          </div>

          <ol className="space-y-3 text-sm text-gray-700">
            <Step number={1}>
              Abre <strong>Chrome</strong> y entra a{' '}
              <span className="font-mono text-primary-700 text-xs">avi-app.com.mx</span>
            </Step>
            <Step number={2}>
              Toca el menú de tres puntos{' '}
              <span className="inline-block bg-gray-100 rounded px-2 py-0.5 text-xs">⋮</span>{' '}
              en la esquina superior derecha
            </Step>
            <Step number={3}>
              Toca <strong>"Agregar a pantalla de inicio"</strong> o{' '}
              <strong>"Instalar app"</strong>
            </Step>
            <Step number={4}>
              Confirma tocando <strong>"Agregar"</strong> o <strong>"Instalar"</strong>
            </Step>
            <Step number={5}>
              ¡Listo! AVI aparecerá en tu pantalla de inicio y funciona como app nativa.
            </Step>
          </ol>

          <div className="bg-green-50 rounded-xl px-4 py-3 text-xs text-green-700">
            💡 En algunos Android también verás un banner automático en la parte inferior
            de Chrome que dice "Instalar AVI" — puedes tocarlo directamente.
          </div>
        </div>

        {/* Nota general */}
        <div className="bg-primary-50 rounded-2xl px-5 py-4 text-sm text-primary-700 text-center">
          Una vez instalada, AVI abre directamente sin mostrar la barra del navegador,
          igual que cualquier app descargada de la tienda.
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Regresar al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700
                       text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  )
}
