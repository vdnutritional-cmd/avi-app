import Link from 'next/link'
import InstallBanner, {
  SafariBarSVG,
  ShareButtonSVG,
  AddToHomeSVG,
  ConfirmSVG,
} from '@/components/InstallBanner'

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

        {/* ── iPhone / Safari ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍎</span>
            <div>
              <h2 className="font-semibold text-gray-800">iPhone (Safari)</h2>
              <p className="text-xs text-gray-400">iOS 16.4 o superior recomendado</p>
            </div>
          </div>

          <ol className="space-y-5 text-sm text-gray-700">

            <Step number={1} illustration={<SafariBarSVG />}>
              Abre <strong>Safari</strong> y entra a{' '}
              <span className="font-mono text-primary-700 text-xs">avi-app.com.mx</span>
            </Step>

            <Step number={2} illustration={<ShareButtonSVG />}>
              Toca el botón de <strong>Compartir</strong>{' '}
              (cuadro con flecha hacia arriba) en la barra de Safari.
              Puede estar en la <strong>barra inferior</strong> o en la{' '}
              <strong>esquina superior derecha</strong>, según tus ajustes.
            </Step>

            <Step number={3} illustration={<AddToHomeSVG />}>
              Desliza el menú hacia abajo hasta encontrar{' '}
              <strong>&ldquo;Agregar a pantalla de inicio&rdquo;</strong> y tócalo.
            </Step>

            <Step number={4} illustration={<ConfirmSVG />}>
              Escribe <strong>&ldquo;AVI&rdquo;</strong> como nombre (o deja el que aparece)
              y toca <strong>&ldquo;Agregar&rdquo;</strong> en la esquina superior derecha.
            </Step>

            <Step number={5}>
              ¡Listo! El ícono de AVI aparecerá en tu pantalla de inicio como cualquier otra app.
            </Step>

          </ol>

          <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-700">
            ⚠️ Solo funciona desde <strong>Safari</strong>. Chrome en iPhone no permite instalar apps.
          </div>
        </div>

        {/* ── Android / Chrome ── */}
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
              Chrome mostrará automáticamente un banner en la parte inferior con el botón{' '}
              <strong>&ldquo;Instalar&rdquo;</strong> — tócalo directamente.
            </Step>
            <Step number={3}>
              Si el banner no aparece, toca el menú de tres puntos{' '}
              <span className="inline-block bg-gray-100 rounded px-2 py-0.5 text-xs">⋮</span>{' '}
              (esquina superior derecha) y selecciona{' '}
              <strong>&ldquo;Agregar a pantalla de inicio&rdquo;</strong> o{' '}
              <strong>&ldquo;Instalar app&rdquo;</strong>.
            </Step>
            <Step number={4}>
              Confirma tocando <strong>&ldquo;Agregar&rdquo;</strong> o{' '}
              <strong>&ldquo;Instalar&rdquo;</strong>.
            </Step>
            <Step number={5}>
              ¡Listo! AVI aparecerá en tu pantalla de inicio y funciona como app nativa.
            </Step>
          </ol>

          <div className="bg-green-50 rounded-xl px-4 py-3 text-xs text-green-700">
            💡 El banner de instalación aparece automáticamente al abrir la página.
          </div>
        </div>

        {/* Nota general */}
        <div className="bg-primary-50 rounded-2xl px-5 py-4 text-sm text-primary-700 text-center">
          Una vez instalada, AVI abre directamente sin mostrar la barra del navegador,
          igual que cualquier app descargada de la tienda.
        </div>

        {/* Guía de registro y primer ingreso */}
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold text-gray-800">Cómo registrarte y comenzar</h2>
            <p className="text-sm text-gray-500">Sigue estos pasos la primera vez que entres a AVI</p>
          </div>

          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
              <img
                src={`/guia/paso-${n}.png`}
                alt={`Paso ${n}`}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Regresar al inicio
          </Link>
        </div>
      </div>

      {/* Banner flotante de instalación */}
      <InstallBanner />
    </main>
  )
}

function Step({
  number,
  children,
  illustration,
}: {
  number: number
  children: React.ReactNode
  illustration?: React.ReactNode
}) {
  return (
    <li className="space-y-2">
      <div className="flex gap-3">
        <span className="shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700
                         text-xs font-bold flex items-center justify-center mt-0.5">
          {number}
        </span>
        <span className="leading-relaxed">{children}</span>
      </div>
      {illustration && (
        <div className="ml-9 bg-gray-50 rounded-xl p-3 flex justify-center">
          {illustration}
        </div>
      )}
    </li>
  )
}
