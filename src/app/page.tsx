import Link from 'next/link'

/**
 * Página de inicio / landing de AVI
 * El middleware redirige automáticamente a usuarios con sesión activa.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo / nombre */}
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-primary-700 tracking-tight">
            AVI
          </h1>
          <p className="text-lg text-gray-600">
            Acompañamiento Virtual Integral para el bienestar emocional
          </p>
        </div>

        {/* Descripción */}
        <p className="text-gray-500 text-sm leading-relaxed">
          Una plataforma que conecta a terapeutas con sus pacientes, apoyando
          el proceso terapéutico entre sesiones con base en el personalismo y
          la terapia familiar.
        </p>

        {/* Botones de acceso */}
        <div className="flex flex-col gap-3">
          <Link
            href="/auth/login"
            className="w-full py-3 px-6 bg-primary-600 text-white rounded-2xl font-semibold
                       hover:bg-primary-700 transition-colors text-center"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/auth/register"
            className="w-full py-3 px-6 bg-white text-primary-600 border-2 border-primary-200
                       rounded-2xl font-semibold hover:bg-primary-50 transition-colors text-center"
          >
            Soy terapeuta — Registrarme
          </Link>
          <Link
            href="/auth/register-with-code"
            className="w-full py-3 px-6 text-gray-500 rounded-2xl font-medium
                       hover:text-gray-700 transition-colors text-center text-sm"
          >
            Tengo un código de acceso →
          </Link>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-gray-400">
          AVI no reemplaza la atención terapéutica profesional.
          Es un complemento de apoyo entre sesiones.
        </p>

        {/* Links de pie */}
        <div className="flex flex-col gap-2 items-center">
          <Link
            href="/pricing"
            className="text-sm text-primary-500 hover:text-primary-700 transition-colors"
          >
            Ver planes y precios →
          </Link>
          <Link
            href="/install"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            📱 Cómo instalar AVI en tu celular →
          </Link>
        </div>
      </div>
    </main>
  )
}
