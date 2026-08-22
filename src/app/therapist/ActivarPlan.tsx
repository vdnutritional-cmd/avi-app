'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

// ── Tabla comparativa de funciones ────────────────────────────
function FeatureTable() {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set())

  function toggleSection(n: number) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  return (
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
  )
}

// ── Botón de checkout ──────────────────────────────────────────
function CheckoutButton({
  label, planId, slots, variant = 'purple', requiresCode = false, empresaIds = [],
}: {
  label: string
  planId: string
  slots?: number
  variant?: 'purple' | 'white'
  requiresCode?: boolean
  empresaIds?: string[]
}) {
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    if (requiresCode && !showCodeInput) {
      setShowCodeInput(true)
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        slots,
        convenioCode: requiresCode ? code.trim().toUpperCase() : undefined,
        empresaIds: requiresCode ? empresaIds : undefined,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.url) {
      window.location.href = data.url
    } else if (data.error) {
      setError(data.error)
    } else {
      setError('Ocurrió un error. Intenta de nuevo.')
    }
  }

  const base = 'w-full py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50'
  const styles = variant === 'white'
    ? `${base} bg-white text-purple-700 hover:bg-purple-50`
    : `${base} bg-purple-700 text-white hover:bg-purple-800`

  return (
    <div className="space-y-2">
      {showCodeInput && (
        <div>
          <input
            type="text"
            placeholder="Tu código CONVENIO"
            value={code}
            onChange={e => { setCode(e.target.value); setError('') }}
            className="w-full border border-white/30 bg-white/10 text-white placeholder-white/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 uppercase"
            autoFocus
          />
          {error && <p className="text-red-300 text-xs mt-1">{error}</p>}
        </div>
      )}
      <button
        onClick={handleClick}
        disabled={loading || (showCodeInput && code.trim().length < 3)}
        className={styles}
      >
        {loading ? 'Verificando…' : showCodeInput ? 'Confirmar y suscribirse' : label}
      </button>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function ActivarPlan({ therapistName }: { therapistName: string }) {
  const router = useRouter()
  const [tier, setTier] = useState<PlanTier>('esencial')
  const [customSlots, setCustomSlots] = useState(3)
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([])
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState<string[]>([])
  const [whatsappEnviado, setWhatsappEnviado] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogoutAndHome() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  function abrirWhatsApp(url: string) {
    window.open(url, '_blank')
    setWhatsappEnviado(true)
  }

  useEffect(() => {
    fetch('/api/convenio-empresas')
      .then(r => r.json())
      .then(d => setEmpresas(d.empresas ?? []))
      .catch(() => {})
  }, [])

  function toggleEmpresa(id: string) {
    setEmpresasSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const empresasNombres = empresas
    .filter(e => empresasSeleccionadas.includes(e.id))
    .map(e => e.nombre)
    .join(', ')

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
      <header className="py-8 px-6 text-center relative">
        <button
          onClick={handleLogoutAndHome}
          disabled={loggingOut}
          className="absolute top-4 right-4 text-xs font-bold transition-colors disabled:opacity-50"
          style={{ color: '#b243d5' }}
        >
          {loggingOut ? 'Saliendo…' : 'Cerrar sesión →'}
        </button>
        <span className="text-2xl font-bold text-purple-700">AVI</span>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Hola{therapistName ? `, ${therapistName}` : ''}
        </h1>
        <p className="mt-2 text-gray-500 max-w-md mx-auto">
          Para acceder a AVI necesitas activar un plan o contar con aprobación del administrador.
        </p>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pb-16 space-y-10">

        {/* ── Tabla comparativa ── */}
        <FeatureTable />

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

        {/* ── Paquetes en CONVENIO ── */}
        <section className="bg-gradient-to-r from-purple-700 to-purple-900 rounded-2xl p-6 text-white">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold mb-1">Paquetes en CONVENIO</h2>
              <p className="text-purple-200 text-xs">
                Exclusivo para Asesores activos que participan en empresas en CONVENIO.
              </p>
            </div>
            {empresas.length > 0 && (
              <div className="shrink-0">
                <p className="text-xs text-purple-300 mb-2">Empresas en CONVENIO en que participas</p>
                <div className="space-y-1.5">
                  {empresas.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={empresasSeleccionadas.includes(emp.id)}
                        onChange={() => toggleEmpresa(emp.id)}
                        className="w-4 h-4 accent-purple-300 rounded cursor-pointer"
                      />
                      <span className="text-sm text-white/90 group-hover:text-white transition-colors">
                        {emp.nombre}
                      </span>
                    </label>
                  ))}
                </div>
                {empresasSeleccionadas.length > 0 && (
                  <p className="mt-2 text-xs text-green-300">
                    ✓ {empresasSeleccionadas.length === 1 ? '1 empresa seleccionada' : `${empresasSeleccionadas.length} empresas seleccionadas`}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {valoraPlans.map(plan => (
              <div key={plan.id} className="bg-white/10 rounded-xl p-4 border border-white/20">
                <p className="text-xs font-semibold text-purple-200 mb-1">{plan.name}</p>
                <div className="mb-0.5">
                  <span className="text-2xl font-bold">${plan.priceUSD}</span>
                  <span className="text-purple-300 text-[10px] ml-1">USD/mes</span>
                </div>
                <p className="text-xs text-purple-300 mb-0.5">${plan.unitPriceUSD}/paciente</p>
                <span className="text-[10px] text-green-300 font-medium block mb-3">
                  Ahorra {plan.savingsVsUnit}% vs precio estándar
                </span>
                <CheckoutButton label="Elegir plan en CONVENIO" planId={plan.id} variant="white" requiresCode empresaIds={empresasSeleccionadas} />
              </div>
            ))}
          </div>
          <div className="border-t border-white/20 pt-4">
            <p className="text-xs text-purple-200 mb-3">
              ¿Eres Asesor o Terapeuta activo en una institución en CONVENIO? Solicita por WhatsApp obtener precio en descuento o acceso gratuito.
            </p>
            <button
              onClick={() => abrirWhatsApp(`https://wa.me/523318830312?text=${encodeURIComponent(
                `Hola, soy Asesor/Terapeuta activo en ${empresasNombres || '<empresa en convenio>'}. Solicito acceso a AVI en la modalidad del Convenio con ${empresasNombres || '<empresa en convenio>'}. Mi nombre es: `
              )}`)}
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-xl font-medium transition-colors"
            >
              💬 Solicitar por WhatsApp
            </button>
          </div>
        </section>

        {/* ── Cerrar sesión (medio página) ── */}
        <div className="text-center">
          <button
            onClick={handleLogoutAndHome}
            disabled={loggingOut}
            className="text-sm font-bold transition-colors disabled:opacity-50"
            style={{ color: '#b243d5' }}
          >
            {loggingOut ? 'Saliendo…' : 'Cerrar sesión →'}
          </button>
        </div>

        {/* ── Patrocinio ── */}
        <section className="text-center border border-dashed border-gray-200 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">¿Necesitas apoyo económico?</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
            Contamos con programas de patrocinio. Contáctanos y te orientamos.
          </p>
          <button
            onClick={() => abrirWhatsApp('https://wa.me/523318830312?text=Hola%2C%20deseo%20información%20sobre%20el%20programa%20de%20patrocinio%20de%20AVI')}
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-4 py-2 rounded-xl transition-colors"
          >
            💬 Contáctanos
          </button>
        </section>

        {/* ── Confirmación WhatsApp ── */}
        {whatsappEnviado && (
          <section className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <p className="text-sm font-semibold text-green-800">¡Mensaje enviado!</p>
            <p className="text-sm text-green-700 max-w-md mx-auto">
              En un lapso de 24 a 48 horas se validará tu participación en la empresa de Convenio
              y recibirás respuesta por WhatsApp de la viabilidad de patrocinio al 100% o con descuento.
            </p>
            <button
              onClick={handleLogoutAndHome}
              disabled={loggingOut}
              className="mt-2 inline-flex items-center gap-2 bg-purple-700 hover:bg-purple-800 text-white text-sm px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {loggingOut ? 'Saliendo…' : 'Entendido — Volver al inicio'}
            </button>
          </section>
        )}

      </main>
    </div>
  )
}
