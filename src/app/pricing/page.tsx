'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ESENCIAL_PLANS,
  ESENCIAL_VALORA_PLANS,
  CLINICO_PLANS,
  CLINICO_VALORA_PLANS,
  UNIT_PRICE_ESENCIAL,
  UNIT_PRICE_CLINICO,
  calcUnitPrice,
  type PlanTier,
} from '@/lib/stripe/plans'
import SponsorsSection from '@/components/SponsorsSection'


export default function PricingPage() {
  const [tier, setTier] = useState<PlanTier>('esencial')
  const [customSlots, setCustomSlots] = useState(3)
  const [openSections, setOpenSections] = useState<Set<number>>(new Set())

  function toggleSection(n: number) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  const isEsencial  = tier === 'esencial'
  const unitPrice   = isEsencial ? UNIT_PRICE_ESENCIAL : UNIT_PRICE_CLINICO
  const packPlans   = isEsencial
    ? ESENCIAL_PLANS.filter(p => p.type === 'paid')
    : CLINICO_PLANS.filter(p => p.type === 'paid')
  const valoraPlans = isEsencial ? ESENCIAL_VALORA_PLANS : CLINICO_VALORA_PLANS
  const unitPlanId  = isEsencial ? 'esencial_unit' : 'clinico_unit'

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

      <main className="max-w-6xl mx-auto px-6 pb-20 space-y-14">

        {/* ── Tabla comparativa + Selector de tier ── */}
        <section>
          {/* Tabla comparativa de funciones */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-sm font-bold uppercase tracking-wide w-full" style={{ color: '#b243d5' }}>Función</th>
                    <th className="px-4 py-2 text-center text-sm font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#b243d5' }}>Esencial</th>
                    <th className="px-4 py-2 text-center text-sm font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#b243d5' }}>Clínico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">

                  {/* ── CONSÚLTAME ── */}
                  <tr className="bg-purple-50">
                    <td colSpan={3} className="px-3 py-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#b243d5' }}>
                      Consúltame
                    </td>
                  </tr>
                  {[
                    'Registro y selección de pacientes',
                    'Códigos de acceso para pacientes',
                    'Chat AVI acompañamiento (pacientes)',
                    'Resumen de sesiones AVI (por paciente)',
                    'Registro de entrevista inicial',
                    'Registro de sesiones presenciales',
                    'Análisis clínico del caso (incluye propuesta 10 sesiones)',
                    'Tipo de sesión presencial',
                    'Reporte de asesorías/terapias',
                  ].map(f => (
                    <tr key={f} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-0.5 text-gray-700">• {f}</td>
                      <td className="px-3 py-0.5 text-center text-green-600 font-bold">✔</td>
                      <td className="px-3 py-0.5 text-center text-green-600 font-bold">✔</td>
                    </tr>
                  ))}

                  {/* ── EXPEDIENTE CLÍNICO ── */}
                  <tr className="bg-purple-50">
                    <td colSpan={3} className="px-3 py-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#b243d5' }}>
                      Expediente Clínico (incisos 1 a 6)
                    </td>
                  </tr>
                  {['Datos generales'].map(f => (
                    <tr key={f} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-0.5 text-gray-700">• {f}</td>
                      <td className="px-3 py-0.5 text-center text-gray-300">—</td>
                      <td className="px-3 py-0.5 text-center text-green-600 font-bold">✔</td>
                    </tr>
                  ))}

                  {/* ── Secciones colapsables 1–6 ── */}
                  {([
                    {
                      n: 1, label: '1. Individual',
                      items: [
                        'Dimensiones evolutivas (áreas de desarrollo)',
                        'Contexto',
                        'Antecedentes de relevancia',
                        'Sintomatología observada',
                      ],
                    },
                    {
                      n: 2, label: '2. Familiar',
                      items: [
                        'Síntomas',
                        'Detonadores',
                        'Factores de riesgo',
                        'Funciones familiares presentes y no presentes',
                        'Características maternas y paternas (vinculación afectiva)',
                        'Referentes de disfuncionalidad',
                        'Tipo de disfunción observada',
                        'Ciclo vital de la familia',
                        'Procesos familiares',
                      ],
                    },
                    {
                      n: 3, label: '3. Pareja',
                      items: [
                        'Conformación estructural',
                        'Tipo de amor',
                        'Roles de la pareja',
                        'Áreas funcionales y disfuncionales de la pareja',
                      ],
                    },
                    {
                      n: 4, label: '4. Prediagnóstico & Vías de acción',
                      items: [
                        'Prediagnóstico',
                        'Plan de intervención (con propuesta 10 sesiones base Prediagnóstico)',
                      ],
                    },
                    {
                      n: 5, label: '5. Técnicas de análisis e interpretación',
                      items: ['Cuestionarios e interpretación (varios)'],
                    },
                    {
                      n: 6, label: '6. Impresiones',
                      items: ['Reportes AVI y de protocolo (varios)'],
                    },
                  ] as const).map(({ n, label, items }) => {
                    const isOpen = openSections.has(n)
                    return (
                      <>
                        {/* Fila de encabezado colapsable */}
                        <tr
                          key={`sec-${n}`}
                          onClick={() => toggleSection(n)}
                          className="bg-white cursor-pointer hover:bg-purple-50 transition-colors select-none"
                        >
                          <td className="px-3 py-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#b243d5' }}>
                            <span className="mr-1.5 text-[10px]">{isOpen ? '▼' : '▶'}</span>
                            {label}
                            <span className="ml-2 text-[9px] font-normal normal-case text-gray-400">
                              {isOpen ? 'ocultar detalle' : 'ver detalle'}
                            </span>
                          </td>
                          <td className="px-3 py-1 text-center text-gray-300 text-xs">—</td>
                          <td className="px-3 py-1 text-center text-green-600 font-bold text-xs">
                            {isOpen ? '' : '✔'}
                          </td>
                        </tr>
                        {/* Filas de detalle (colapsables) */}
                        {isOpen && items.map(f => (
                          <tr key={f} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-0.5 text-gray-600">• {f}</td>
                            <td className="px-3 py-0.5 text-center text-gray-300">—</td>
                            <td className="px-3 py-0.5 text-center text-green-600 font-bold">✔</td>
                          </tr>
                        ))}
                      </>
                    )
                  })}

                </tbody>
              </table>
            </div>
          </div>

          {/* Selector de tier — debajo de la tabla */}
          <div className="flex justify-center mt-8">
            <div className="inline-flex bg-gray-100 rounded-2xl p-1.5 gap-1">
              <button
                onClick={() => setTier('esencial')}
                className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isEsencial
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                AVI Esencial
              </button>
              <button
                onClick={() => setTier('clinico')}
                className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all ${
                  !isEsencial
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                AVI Clínico
              </button>
            </div>
          </div>
        </section>

        {/* ── Precio por paciente ── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Precio por paciente</h2>
          <p className="text-sm text-gray-500 mb-6">
            ¿Sabes exactamente cuántos pacientes necesitas? Paga solo por ellos
            a ${unitPrice} USD/paciente al mes.
          </p>
          <div className="bg-white border border-purple-100 rounded-2xl p-8 shadow-sm max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de pacientes
            </label>
            <div className="flex items-center gap-4 mb-6">
              <input
                type="range" min={1} max={50} value={customSlots}
                onChange={e => setCustomSlots(Number(e.target.value))}
                className="flex-1 accent-purple-600"
              />
              <input
                type="number" min={1} max={50} value={customSlots}
                onChange={e => setCustomSlots(Math.max(1, Math.min(50, Number(e.target.value))))}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center text-sm"
              />
            </div>
            <div className="flex items-end justify-between mb-6">
              <div>
                <span className="text-4xl font-bold text-purple-700">
                  ${calcUnitPrice(customSlots, tier).toFixed(2)}
                </span>
                <span className="text-gray-400 text-sm ml-1">USD/mes</span>
              </div>
              <span className="text-sm text-gray-400">
                {customSlots} pac × ${unitPrice}
              </span>
            </div>
            <CheckoutButton
              label={`Suscribirme — ${customSlots} pacientes`}
              planId={unitPlanId}
              slots={customSlots}
            />
          </div>
        </section>

        {/* ── Paquetes ── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Paquetes</h2>
          <p className="text-sm text-gray-500 mb-6">
            Precio fijo mensual con descuento frente al precio unitario.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {packPlans.map(plan => (
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
                <p className="text-xs text-gray-400 mb-1">${plan.unitPriceUSD}/paciente</p>
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

          {/* Nota IVA */}
          <p className="mt-6 text-center text-xs text-gray-400">
            * Al pago se le añadirá el IVA correspondiente (16% en México).
          </p>
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
            {valoraPlans.map(plan => (
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
                <p className="text-xs text-purple-300 mb-1">${plan.unitPriceUSD}/paciente</p>
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
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              <span>💬</span> Solicitar por WhatsApp
            </a>
          </div>
        </section>

        {/* ── Plan gratuito / Patrocinios ── */}
        <section className="text-center border border-dashed border-gray-200 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Empresas que Transforman Vidas</h2>
          <p className="text-sm text-gray-500 max-w-lg mx-auto mb-4">
            AVI cuenta con patrocinios que permiten ofrecer acceso gratuito a Asesorados (pacientes).
            ¿Te gustaría apoyar?
          </p>
          <a
            href="https://wa.me/523318830312?text=Hola%2C%20me%20interesa%20conocer%20el%20programa%20de%20patrocinios%20de%20AVI.%20Mi%20nombre%20es%3A%20"
            target="_blank" rel="noopener noreferrer"
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

// ── Botón de checkout ─────────────────────────────────────────
function CheckoutButton({
  label, planId, slots, variant = 'purple',
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
  const styles = variant === 'white'
    ? `${base} bg-white text-purple-700 hover:bg-purple-50`
    : `${base} bg-purple-700 text-white hover:bg-purple-800`

  return (
    <button onClick={handleClick} className={styles}>
      {label}
    </button>
  )
}
