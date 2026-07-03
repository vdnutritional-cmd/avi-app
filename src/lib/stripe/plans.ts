// ─────────────────────────────────────────────────────────────
// AVI — Planes y precios
// Los STRIPE_PRICE_ID se llenan después de crear los productos
// en el dashboard de Stripe (dashboard.stripe.com/products)
// ─────────────────────────────────────────────────────────────

export type PlanType = 'unit' | 'paid' | 'valora' | 'free'

export interface Plan {
  id: string
  type: PlanType
  name: string
  description: string
  patientSlots: number | 'custom'  // 'custom' = el terapeuta elige N
  priceUSD: number                  // precio total mensual
  unitPriceUSD: number              // precio por paciente
  savingsVsUnit?: number            // ahorro vs precio unitario (%)
  stripePriceId: string             // llenar después de crear en Stripe
  isValora?: boolean
  highlight?: boolean               // destacar en la UI
}

// ── Precio unitario: $3.35 × N pacientes ──────────────────────
export const UNIT_PRICE_PER_PATIENT = 3.35

// ── Paquetes estándar ─────────────────────────────────────────
export const STANDARD_PLANS: Plan[] = [
  {
    id: 'pack_5',
    type: 'paid',
    name: 'Paquete 5',
    description: '5 pacientes activos por mes',
    patientSlots: 5,
    priceUSD: 15.00,
    unitPriceUSD: 3.00,
    savingsVsUnit: 10,  // vs $16.75 unitario
    stripePriceId: process.env.STRIPE_PRICE_PACK5 ?? '',
  },
  {
    id: 'pack_10',
    type: 'paid',
    name: 'Paquete 10',
    description: '10 pacientes activos por mes',
    patientSlots: 10,
    priceUSD: 29.50,
    unitPriceUSD: 2.95,
    savingsVsUnit: 12,  // vs $33.50 unitario
    stripePriceId: process.env.STRIPE_PRICE_PACK10 ?? '',
    highlight: true,
  },
  {
    id: 'pack_20',
    type: 'paid',
    name: 'Paquete 20',
    description: '20 pacientes activos por mes',
    patientSlots: 20,
    priceUSD: 58.00,
    unitPriceUSD: 2.90,
    savingsVsUnit: 13,  // vs $67.00 unitario
    stripePriceId: process.env.STRIPE_PRICE_PACK20 ?? '',
  },
  {
    id: 'pack_30',
    type: 'paid',
    name: 'Paquete 30',
    description: '30 pacientes activos por mes',
    patientSlots: 30,
    priceUSD: 85.50,
    unitPriceUSD: 2.85,
    savingsVsUnit: 15,  // vs $100.50 unitario
    stripePriceId: process.env.STRIPE_PRICE_PACK30 ?? '',
  },
  {
    id: 'pack_40',
    type: 'paid',
    name: 'Paquete 40',
    description: '40 pacientes activos por mes',
    patientSlots: 40,
    priceUSD: 110.00,
    unitPriceUSD: 2.75,
    savingsVsUnit: 18,  // vs $134.00 unitario
    stripePriceId: process.env.STRIPE_PRICE_PACK40 ?? '',
  },
]

// ── Paquetes VALORA (asesores activos) ───────────────────────
export const VALORA_PLANS: Plan[] = [
  {
    id: 'valora_10',
    type: 'valora',
    name: 'VALORA 10',
    description: '10 pacientes — Precio especial asesores VALORA',
    patientSlots: 10,
    priceUSD: 20.00,
    unitPriceUSD: 2.00,
    savingsVsUnit: 40,  // vs $33.50 unitario
    stripePriceId: process.env.STRIPE_PRICE_VALORA10 ?? '',
    isValora: true,
  },
  {
    id: 'valora_20',
    type: 'valora',
    name: 'VALORA 20',
    description: '20 pacientes — Precio especial asesores VALORA',
    patientSlots: 20,
    priceUSD: 39.00,
    unitPriceUSD: 1.95,
    savingsVsUnit: 42,  // vs $67.00 unitario
    stripePriceId: process.env.STRIPE_PRICE_VALORA20 ?? '',
    isValora: true,
    highlight: true,
  },
]

// ── Utilidades ────────────────────────────────────────────────

/** Calcula el precio para N pacientes al precio unitario */
export function calcUnitPrice(slots: number): number {
  return Math.round(slots * UNIT_PRICE_PER_PATIENT * 100) / 100
}

/** Busca un plan por su Stripe price ID */
export function getPlanByStripeId(priceId: string): Plan | undefined {
  return [...STANDARD_PLANS, ...VALORA_PLANS].find(p => p.stripePriceId === priceId)
}

/** Devuelve los patient_slots de un plan dado su id */
export function getSlotsForPlan(planId: string, customSlots?: number): number {
  if (planId === 'unit') return customSlots ?? 1
  const all = [...STANDARD_PLANS, ...VALORA_PLANS]
  const plan = all.find(p => p.id === planId)
  return typeof plan?.patientSlots === 'number' ? plan.patientSlots : 1
}
