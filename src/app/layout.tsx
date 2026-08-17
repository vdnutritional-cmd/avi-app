import type { Metadata, Viewport } from 'next'
import './globals.css'
import SwRegistrar from './SwRegistrar'

export const metadata: Metadata = {
  title: 'AVI — Acompañamiento Integral',
  description: 'Plataforma terapéutica para consultores y consultantes',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AVI',
    startupImage: '/icons/apple-touch-icon-v2.png',
  },
  icons: {
    apple: '/icons/apple-touch-icon-v2.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#b243d5',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white antialiased">
        <SwRegistrar />
        {children}
      </body>
    </html>
  )
}
