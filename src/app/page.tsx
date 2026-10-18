import Link from 'next/link'
import Image from 'next/image'
import WhatsAppSupport from '@/components/WhatsAppSupport'
import InstallBanner from '@/components/InstallBanner'

// Oculto temporalmente (oct 2026): confunde y no se usa por ahora.
// La ruta /auth/register-with-code sigue activa; cambiar a true para mostrar el enlace.
const MOSTRAR_CODIGO_ACCESO = false

/**
 * Página de inicio / landing de AVI
 * El middleware redirige automáticamente a usuarios con sesión activa.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo oficial "AVI Therapy Companion" (imagen de José Luis, 18 oct 2026), recortado
            sin márgenes y con fondo transparente: public/logo-avi-therapy-companion.png (1239 × 198) */}
        <div className="space-y-3">
          <h1 className="flex justify-center">
            <Image
              src="/logo-avi-therapy-companion.png"
              alt="AVI Therapy Companion"
              width={1239}
              height={198}
              priority
              className="w-full max-w-[380px] h-auto"
            />
          </h1>
          <p className="text-lg text-gray-600">
            Acompañamiento Virtual Interactivo para el bienestar emocional
          </p>
        </div>

        {/* Descripción: alineada a la izquierda (la página va centrada) */}
        <p className="text-gray-500 text-sm leading-relaxed text-left">
          AVI es una app virtual interactiva que acompaña terapéuticamente a
          los pacientes entre sesiones. Además, facilita al
          terapeuta la preparación de sus sesiones, de acuerdo con el enfoque
          terapéutico elegido, y la documentación del proceso conforme a la
          normatividad vigente.
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
            Soy terapeuta o asesor — Registrarme
          </Link>
          {MOSTRAR_CODIGO_ACCESO && (
            <Link
              href="/auth/register-with-code"
              className="w-full py-3 px-6 text-gray-500 rounded-2xl font-medium
                         hover:text-gray-700 transition-colors text-center text-sm"
            >
              Tengo un código de acceso →
            </Link>
          )}
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
      <WhatsAppSupport />
      <InstallBanner />
    </main>
  )
}
