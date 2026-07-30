'use client'

import { useState } from 'react'
import {
  ESENCIAL_PLANS,
  CLINICO_PLANS,
  ESENCIAL_VALORA_PLANS,
  CLINICO_VALORA_PLANS,
  UNIT_PRICE_ESENCIAL,
  UNIT_PRICE_CLINICO,
  calcUnitPrice,
  type PlanTier,
} from '@/lib/stripe/plans'

// ── Botón de checkout ──────────────────────────────────────────
function CheckoutButton({
  label, planId, slots, variant = 'purple',
}: {
  label: string
  planId: string
  slots?: number
  variant?: 'purple' | 'white'
}) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, slots }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Ocurrió un error. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const base = 'w-full py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50'
  const styles = variant === 'white'
    ? `${base} bg-white text-purple-700 hover:bg-purple-50`
    : `${base} bg-purple-700 text-white hover:bg-purple-800`

  return (
    <button onClick={handleClick} disabled={loading} className={styles}>
      {loading ? 'Redirigiendo…' : label}
    </button>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function ActivarPlan({ therapistName }: { therapistName: string }) {
  const [tier, setTier] = useState<PlanTier>('esencial')
  const [customSlots, setCustomSlots] = useState(3)

  const isEsencial = tier === 'esencial'
  const unitPrice  = isEsencial ? UNIT_PRICE_ESENCIAL : UNIT_PRICE_CLINICO
  const packPlans  = isEsencial
    ? ESENCIAL_PLANS.filter(p => p.type === 'paid')
    : CLINICO_PLANS.filter(p => p.type === 'paid')
  const valoraPlans = isEsencial ? ESENCIAL_VALORA_PLANS : CLINICO_VALORA_PLANS
  const unitPlanId  = isEsencial ? 'esencial_unit' : 'clinico_unit'

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col">

      {/* Header */}
      <header className="py-8 px-6 text-center">
        <span className="text-2xl font-bold text-purple-700">AVI</span>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Hola{therapistName ? `, ${therapistName}` : ''}
        </h1>
        <p className="mt-2 text-gray-500 max-w-md mx-auto">
          Para acceder a AVI necesitas activar un plan o contar con aprobación del administrador.
        </p>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pb-16 space-y-10">

        {/* ── Selector de tier ── */}
        <div className="flex justify-center">
          <div className="inline-flex bg-gray-100 rounded-2xl p-1.5 gap-1">
            <button
              onClick={() => setTier('esencial')}
              className={`px-7 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isEsencial ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              AVI Esencial
            </button>
            <button
              onClick={() => setTier('clinico')}
              className={`px-7 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                !isEsencial ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              AVI Clínico
            </button>
          </div>
        </div>

        {/* ── Precio por paciente (unitario) ── */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-4">Precio por paciente</h2>
          <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm max-w-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de pacientes
            </label>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="range" min={1} max={50} value={customSlots}
                onChange={e => setCustomSlots(Number(e.target.value))}
                className="flex-1 accent-purple-600"
              />
              <input
                type="number" min={1} max={50} value={customSlots}
                onChange={e => setCustomSlots(Math.max(1, Math.min(50, Number(e.target.value))))}
                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-center text-sm"
              />
            </div>
            <div className="flex items-end justify-between mb-4">
              <div>
                <span className="text-3xl font-bold text-purple-700">
                  ${calcUnitPrice(customSlots, tier).toFixed(2)}
                </span>
                <span className="text-gray-400 text-xs ml-1">USD/mes</span>
              </div>
              <span className="text-xs text-gray-400">{customSlots} pac × ${unitPrice}</span>
            </div>
            <CheckoutButton
              label={`Suscribirme — ${customSlots} pacientes`}
              planId={unitPlanId}
              slots={customSlots}
            />
          </div>
        </section>

        {/* ── Paquetes fijos ── */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-4">Paquetes con descuento</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {packPlans.map(plan => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl border p-4 shadow-sm flex flex-col ${
                  plan.highlight ? 'border-purple-400 ring-2 ring-purple-200' : 'border-gray-100'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                    Más popular
                  </span>
                )}
                <p className="text-xs font-semibold text-gray-500 mb-1">{plan.name}</p>
                <div className="mb-0.5">
                  <span className="text-2xl font-bold text-gray-900">${plan.priceUSD}</span>
                  <span className="text-gray-400 text-[10px] ml-1">USD/mes</span>
                </div>
                <p className="text-[10px] text-gray-400 mb-0.5">${plan.unitPriceUSD}/paciente</p>
                {plan.savingsVsUnit && (
                  <span className="text-[10px] text-green-600 font-medium mb-3">
                    Ahorra {plan.savingsVsUnit}%
                  </span>
                )}
                <p className="text-xs text-gray-500 mb-4 flex-1">{plan.description}</p>
                <CheckoutButton label="Elegir" planId={plan.id} />
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            * Al pago se añadirá el IVA correspondiente (16% en México).
          </p>
        </section>

        {/* ── Paquetes VALORA ── */}
        <section className="bg-gradient-to-r from-purple-700 to-purple-900 rounded-2xl p-6 text-white">
          <h2 className="text-base font-bold mb-1">Paquetes VALORA</h2>
          <p className="text-purple-200 text-xs mb-4">
            Exclusivo para Asesores VALORA activos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {valoraPlans.map(plan => (
              <div key={plan.id} className="bg-white/10 rounded-xl p-4 border border-white/20">
                <p className="text-xs font-semibold text-purple-200 mb-1">{plan.name}</p>
                <div className="mb-0.5">
                  <span className="text-2xl font-bold">${plan.priceUSD}</span>
                  <span className="text-purple-300 text-[10px] ml-1">USD/mes</span>
                </div>
                <span className="text-[10px] text-green-300 font-medium block mb-3">
                  Ahorra {plan.savingsVsUnit}% vs precio estándar
                </span>
                <CheckoutButton label="Elegir plan VALORA" planId={plan.id} variant="white" />
              </div>
            ))}
          </div>
          <div className="border-t border-white/20 pt-4">
            <p className="text-xs text-purple-200 mb-3">
              ¿Eres Asesor VALORA activo y deseas acceso gratuito?
            </p>
            <a
              href="https://wa.me/523318830312?text=Hola%2C%20soy%20Asesor%20VALORA%20activo%20y%20solicito%20acceso%20gratuito%20a%20AVI"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-xl font-medium transition-colors"
            >
              💬 Solicitar por WhatsApp
            </a>
          </div>
        </section>

        {/* ── Patrocinio ── */}
        <section className="text-center border border-dashed border-gray-200 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">¿Necesitas apoyo económico?</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
            Contamos con programas de patrocinio. Contáctanos y te orientamos.
          </p>
          <a
            href="https://wa.me/523318830312?text=Hola%2C%20deseo%20información%20sobre%20el%20programa%20de%20patrocinio%20de%20AVI"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-4 py-2 rounded-xl transition-colors"
          >
            💬 Contáctanos
          </a>
        </section>

      </main>
    </div>
  )
}
