#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# AVI — Script de setup inicial
# Ejecutar UNA VEZ después de clonar o mover el proyecto
# ─────────────────────────────────────────────────────────────────

set -e

echo ""
echo "🚀 Iniciando setup de AVI..."
echo ""

# 1. Verificar Node.js (requiere v18+)
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Se requiere Node.js v18 o superior"
  echo "   Descárgalo en: https://nodejs.org"
  exit 1
fi
echo "✓ Node.js $(node -v)"

# 2. Instalar dependencias
echo ""
echo "📦 Instalando dependencias..."
npm install

# 3. Crear .env.local si no existe
if [ ! -f ".env.local" ]; then
  cp .env.local.example .env.local
  echo ""
  echo "✓ Archivo .env.local creado"
  echo "  ⚠️  IMPORTANTE: Completa las variables en .env.local antes de continuar"
else
  echo "✓ .env.local ya existe"
fi

# 4. Instrucciones finales
echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Setup completado"
echo "═══════════════════════════════════════════════"
echo ""
echo "  Próximos pasos:"
echo ""
echo "  1. Crea un proyecto en Supabase (supabase.com)"
echo "     → Ejecuta el SQL de 'AVI - SQL Migración Supabase.md'"
echo ""
echo "  2. Completa las variables en .env.local:"
echo "     → NEXT_PUBLIC_SUPABASE_URL"
echo "     → NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "     → ANTHROPIC_API_KEY"
echo ""
echo "  3. Configura el redirect de Supabase Auth:"
echo "     → En Supabase → Authentication → URL Configuration"
echo "     → Site URL: http://localhost:3000"
echo "     → Redirect URLs: http://localhost:3000/api/auth/callback"
echo ""
echo "  4. Arranca el servidor de desarrollo:"
echo "     npm run dev"
echo ""
echo "  La app estará en: http://localhost:3000"
echo ""
