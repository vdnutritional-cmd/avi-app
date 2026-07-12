'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  STANDARD_PLANS,
  VALORA_PLANS,
  UNIT_PRICE_PER_PATIENT,
  calcUnitPrice,
} from '@/lib/stripe/plans'
import SponsorsSection from '@/components/SponsorsSection'

export default function PricingPage() {
  const [customSlots, setCustomSlots] = useState(3)

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="py-8 px-6 text-center">
        <Link href="/" className="text-2xl font-bold text-purple-700">AVI</Link>
        <h1 className="mt-6 text-4xl font-bold text-gray-900">Planes y precios</h1>
        <p className="mt-3 text-lg text-gray-500 max-w-xl mx-auto">
          Solo los terapeutas pagan. Los pacientes siempre acceden gratis.
          Cancela o cambia de plan en cualquier momento.
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-20 space-y-16">

        {/* ── Opción unitaria ── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Precio unitario</h2>
          <p className="text-sm text-gray-500 mb-6">
            ¿Sabes exactamente cuántos pacientes necesitas? Paga solo por ellos a ${UNIT_PRICE_PER_PATIENT} USD por paciente al mes.
          </p>
          <div className="bg-white border border-purple-100 rounded-2xl p-8 shadow-sm max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de pacientes
            </label>
            <div className="flex items-center gap-4 mb-6">
              <input
                type="range"
                min={1}
                max={50}
                value={customSlots}
                onChange={e => setCustomSlots(Number(e.target.value))}
                className="flex-1 accent-purple-600"
              />
              <input
                type="number"
                min={1}
                max={50}
                value={customSlots}
                onChange={e => setCustomSlots(Math.max(1, Math.min(50, Number(e.target.value))))}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center text-sm"
              />
            </div>
            <div className="flex items-end justify-between mb-6">
              <div>
                <span className="text-4xl font-bold text-purple-700">
                  ${calcUnitPrice(customSlots).toFixed(2)}
                </span>
                <span className="text-gray-400 text-sm ml-1">USD/mes</span>
              </div>
              <span className="text-sm text-gray-400">
                {customSlots} pac × ${UNIT_PRICE_PER_PATIENT}
              </span>
            </div>
            <CheckoutButton label={`Suscribirme — ${customSlots} pacientes`} planId="unit" slots={customSlots} />
          </div>
        </section>

        {/* ── Paquetes estándar ── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Paquetes</h2>
          <p className="text-sm text-gray-500 mb-6">
            Precio fijo mensual con descuento frente al precio unitario.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {STANDARD_PLANS.map(plan => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl border p-6 shadow-sm flex flex-col ${
                  plan.highlight
                    ? 'border-purple-400 ring-2 ring-purple-200'
                    : 'border-gray-100'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs px-3 py-1 rounded-full">
                    Más popular
                  </span>
                )}
                <p className="text-sm font-semibold text-gray-500 mb-1">{plan.name}</p>
                <div className="mb-1">
                  <span className="text-3xl font-bold text-gray-900">${plan.priceUSD}</span>
                  <span className="text-gray-400 text-xs ml-1">USD/mes</span>
                </div>
                <p className="text-xs text-gray-400 mb-1">
                  ${plan.unitPriceUSD}/paciente
                </p>
                {plan.savingsVsUnit && (
                  <span className="text-xs text-green-600 font-medium mb-4">
                    Ahorra {plan.savingsVsUnit}% vs unitario
                  </span>
                )}
                <p className="text-sm text-gray-600 mb-6 flex-1">{plan.description}</p>
                <CheckoutButton label="Elegir plan" planId={plan.id} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Paquetes VALORA ── */}
        <section className="bg-gradient-to-r from-purple-700 to-purple-900 rounded-2xl p-8 text-white">
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-1">Paquetes VALORA</h2>
            <p className="text-purple-200 text-sm">
              Exclusivo para Asesores VALORA activos. Precio especial o acceso gratuito mediante solicitud.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {VALORA_PLANS.map(plan => (
              <div
                key={plan.id}
                className={`bg-white/10 backdrop-blur rounded-xl p-6 border ${
                  plan.highlight ? 'border-white/40' : 'border-white/20'
                }`}
              >
                <p className="text-sm font-semibold text-purple-200 mb-1">{plan.name}</p>
                <div className="mb-1">
                  <span className="text-3xl font-bold">${plan.priceUSD}</span>
                  <span className="text-purple-300 text-xs ml-1">USD/mes</span>
                </div>
                <p className="text-xs text-purple-300 mb-1">
                  ${plan.unitPriceUSD}/paciente
                </p>
                <span className="text-xs text-green-300 font-medium block mb-4">
                  Ahorra {plan.savingsVsUnit}% vs precio estándar
                </span>
                <CheckoutButton label="Elegir plan VALORA" planId={plan.id} variant="white" />
              </div>
            ))}
          </div>
          <div className="border-t border-white/20 pt-6">
            <p className="text-sm text-purple-200 mb-3">
              ¿Eres Asesor VALORA activo y deseas acceso gratuito?
            </p>
            <a
              href="https://wa.me/523318830312?text=Hola%2C%20soy%20Asesor%20VALORA%20activo%20y%20solicito%20acceso%20gratuito%20a%20AVI"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              <span>💬</span> Solicitar por WhatsApp
            </a>
          </div>
        </section>

        {/* ── Plan gratuito ── */}
        <section className="text-center border border-dashed border-gray-200 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Empresas que Transforman Vidas</h2>
          <p className="text-sm text-gray-500 max-w-lg mx-auto mb-4">
            AVI cuenta con patrocinios que permiten ofrecer acceso gratuito a Asesorados (pacientes).
            ¿Te gustaría apoyar?
          </p>
          <a
            href="https://wa.me/523318830312?text=Hola%2C%20me%20interesa%20conocer%20el%20programa%20de%20patrocinios%20a%20AVI"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            <span>💬</span> ¡Contáctanos!
          </a>
        </section>

        {/* ── Patrocinadores ── */}
        <div className="-mt-8">
          <SponsorsSection />
        </div>

      </main>
    </div>
  )
}

// ── Botón de checkout (conectará con Stripe) ──────────────────
function CheckoutButton({
  label,
  planId,
  slots,
  variant = 'purple',
}: {
  label: string
  planId: string
  slots?: number
  variant?: 'purple' | 'white'
}) {
  async function handleClick() {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, slots }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else alert('Inicia sesión como terapeuta para suscribirte.')
  }

  const base = 'w-full py-2.5 rounded-xl text-sm font-semibold transition-colors'
  const styles =
    variant === 'white'
      ? `${base} bg-white text-purple-700 hover:bg-purple-50`
      : `${base} bg-purple-700 text-white hover:bg-purple-800`

  return (
    <button onClick={handleClick} className={styles}>
      {label}
    </button>
  )
}
