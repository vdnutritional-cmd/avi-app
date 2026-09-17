import type { NextConfig } from 'next'

// cache-bust: 2026-09-17
const nextConfig: NextConfig = {
  // Incluir los archivos docs/*.md en el bundle de las funciones serverless de Vercel.
  // Sin esto, fs.readFileSync('docs/...') falla en producción porque Vercel no los empaqueta.
  outputFileTracingIncludes: {
    '/api/analysis': ['./docs/**/*'],
    '/api/patterns': ['./docs/**/*'],
  },
}

export default nextConfig
