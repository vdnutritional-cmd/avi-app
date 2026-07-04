import type { Metadata, Viewport } from 'next'
import './globals.css'

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
  themeColor: '#7c3aed',
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
        {children}
      </body>
    </html>
  )
}
