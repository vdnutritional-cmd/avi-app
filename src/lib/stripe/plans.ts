// ─────────────────────────────────────────────────────────────
// AVI — Planes y precios
// Dos tiers: Esencial y Clínico
// Cada tier tiene: precio unitario + paquetes 5/10/20/30/40 + VALORA 10/20
// Patrocinios: Semilla, Esperanza, Comunidad, Transforma
// ─────────────────────────────────────────────────────────────

export type PlanType = 'unit' | 'paid' | 'valora' | 'free' | 'patrocinio'
export type PlanTier = 'esencial' | 'clinico'

export interface Plan {
  id: string
  type: PlanType
  tier: PlanTier
  name: string
  description: string
  patientSlots: number | 'custom'
  priceUSD: number
  unitPriceUSD: number
  savingsVsUnit?: number
  stripePriceId: string
  isValora?: boolean
  highlight?: boolean
}

export interface PatrocinioPlan {
  id: string
  type: 'patrocinio'
  name: string
  description: string
  priceUSD: number          // completar con precio real
  stripePriceId: string
}

// ── Precios unitarios base ────────────────────────────────────
export const UNIT_PRICE_ESENCIAL = 2.85
export const UNIT_PRICE_CLINICO  = 3.85

// Alias para compatibilidad con código existente
export const UNIT_PRICE_PER_PATIENT = UNIT_PRICE_ESENCIAL

// ── Paquetes Esencial ─────────────────────────────────────────
export const ESENCIAL_PLANS: Plan[] = [
  {
    id: 'esencial_unit',
    type: 'unit',
    tier: 'esencial',
    name: 'Precio por paciente',
    description: 'Paga solo por los pacientes que necesitas',
    patientSlots: 'custom',
    priceUSD: UNIT_PRICE_ESENCIAL,
    unitPriceUSD: UNIT_PRICE_ESENCIAL,
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_UNIT ?? '',
  },
  {
    id: 'esencial_pack5',
    type: 'paid',
    tier: 'esencial',
    name: 'Esencial 5',
    description: '5 pacientes activos por mes',
    patientSlots: 5,
    priceUSD: 12.50,
    unitPriceUSD: 2.50,
    savingsVsUnit: 12,   // vs $14.25 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_PACK5 ?? '',
  },
  {
    id: 'esencial_pack10',
    type: 'paid',
    tier: 'esencial',
    name: 'Esencial 10',
    description: '10 pacientes activos por mes',
    patientSlots: 10,
    priceUSD: 24.50,
    unitPriceUSD: 2.45,
    savingsVsUnit: 14,   // vs $28.50 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_PACK10 ?? '',
    highlight: true,
  },
  {
    id: 'esencial_pack20',
    type: 'paid',
    tier: 'esencial',
    name: 'Esencial 20',
    description: '20 pacientes activos por mes',
    patientSlots: 20,
    priceUSD: 48.00,
    unitPriceUSD: 2.40,
    savingsVsUnit: 16,   // vs $57.00 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_PACK20 ?? '',
  },
  {
    id: 'esencial_pack30',
    type: 'paid',
    tier: 'esencial',
    name: 'Esencial 30',
    description: '30 pacientes activos por mes',
    patientSlots: 30,
    priceUSD: 70.50,
    unitPriceUSD: 2.35,
    savingsVsUnit: 18,   // vs $85.50 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_PACK30 ?? '',
  },
  {
    id: 'esencial_pack40',
    type: 'paid',
    tier: 'esencial',
    name: 'Esencial 40',
    description: '40 pacientes activos por mes',
    patientSlots: 40,
    priceUSD: 90.00,
    unitPriceUSD: 2.25,
    savingsVsUnit: 21,   // vs $114.00 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_PACK40 ?? '',
  },
]

// ── Paquetes VALORA — Esencial ────────────────────────────────
export const ESENCIAL_VALORA_PLANS: Plan[] = [
  {
    id: 'esencial_valora10',
    type: 'valora',
    tier: 'esencial',
    name: 'VALORA Esencial 10',
    description: '10 pacientes — Precio especial asesores VALORA',
    patientSlots: 10,
    priceUSD: 17.00,
    unitPriceUSD: 1.70,
    savingsVsUnit: 40,   // vs $28.50 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_VALORA10 ?? '',
    isValora: true,
  },
  {
    id: 'esencial_valora20',
    type: 'valora',
    tier: 'esencial',
    name: 'VALORA Esencial 20',
    description: '20 pacientes — Precio especial asesores VALORA',
    patientSlots: 20,
    priceUSD: 32.00,
    unitPriceUSD: 1.60,
    savingsVsUnit: 44,   // vs $57.00 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_VALORA20 ?? '',
    isValora: true,
    highlight: true,
  },
]

// ── Paquetes Clínico ──────────────────────────────────────────
export const CLINICO_PLANS: Plan[] = [
  {
    id: 'clinico_unit',
    type: 'unit',
    tier: 'clinico',
    name: 'Precio por paciente',
    description: 'Paga solo por los pacientes que necesitas',
    patientSlots: 'custom',
    priceUSD: UNIT_PRICE_CLINICO,
    unitPriceUSD: UNIT_PRICE_CLINICO,
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_UNIT ?? '',
  },
  {
    id: 'clinico_pack5',
    type: 'paid',
    tier: 'clinico',
    name: 'Clínico 5',
    description: '5 pacientes activos por mes',
    patientSlots: 5,
    priceUSD: 17.50,
    unitPriceUSD: 3.50,
    savingsVsUnit: 9,    // vs $19.25 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_PACK5 ?? '',
  },
  {
    id: 'clinico_pack10',
    type: 'paid',
    tier: 'clinico',
    name: 'Clínico 10',
    description: '10 pacientes activos por mes',
    patientSlots: 10,
    priceUSD: 34.00,
    unitPriceUSD: 3.40,
    savingsVsUnit: 12,   // vs $38.50 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_PACK10 ?? '',
    highlight: true,
  },
  {
    id: 'clinico_pack20',
    type: 'paid',
    tier: 'clinico',
    name: 'Clínico 20',
    description: '20 pacientes activos por mes',
    patientSlots: 20,
    priceUSD: 66.00,
    unitPriceUSD: 3.30,
    savingsVsUnit: 14,   // vs $77.00 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_PACK20 ?? '',
  },
  {
    id: 'clinico_pack30',
    type: 'paid',
    tier: 'clinico',
    name: 'Clínico 30',
    description: '30 pacientes activos por mes',
    patientSlots: 30,
    priceUSD: 96.00,
    unitPriceUSD: 3.20,
    savingsVsUnit: 17,   // vs $115.50 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_PACK30 ?? '',
  },
  {
    id: 'clinico_pack40',
    type: 'paid',
    tier: 'clinico',
    name: 'Clínico 40',
    description: '40 pacientes activos por mes',
    patientSlots: 40,
    priceUSD: 122.00,
    unitPriceUSD: 3.05,
    savingsVsUnit: 21,   // vs $154.00 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_PACK40 ?? '',
  },
]

// ── Paquetes VALORA — Clínico ─────────────────────────────────
export const CLINICO_VALORA_PLANS: Plan[] = [
  {
    id: 'clinico_valora10',
    type: 'valora',
    tier: 'clinico',
    name: 'VALORA Clínico 10',
    description: '10 pacientes — Precio especial asesores VALORA',
    patientSlots: 10,
    priceUSD: 26.50,
    unitPriceUSD: 2.65,
    savingsVsUnit: 31,   // vs $38.50 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_VALORA10 ?? '',
    isValora: true,
  },
  {
    id: 'clinico_valora20',
    type: 'valora',
    tier: 'clinico',
    name: 'VALORA Clínico 20',
    description: '20 pacientes — Precio especial asesores VALORA',
    patientSlots: 20,
    priceUSD: 50.00,
    unitPriceUSD: 2.50,
    savingsVsUnit: 35,   // vs $77.00 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_VALORA20 ?? '',
    isValora: true,
    highlight: true,
  },
]

// ── Patrocinios ───────────────────────────────────────────────
export const PATROCINIO_PLANS: PatrocinioPlan[] = [
  {
    id: 'semilla',
    type: 'patrocinio',
    name: 'Semilla',
    description: 'Patrocinio nivel Semilla',
    priceUSD: 15.52,
    stripePriceId: process.env.STRIPE_PRICE_PATROCINIO_SEMILLA ?? '',
  },
  {
    id: 'esperanza',
    type: 'patrocinio',
    name: 'Esperanza',
    description: 'Patrocinio nivel Esperanza',
    priceUSD: 31.03,
    stripePriceId: process.env.STRIPE_PRICE_PATROCINIO_ESPERANZA ?? '',
  },
  {
    id: 'comunidad',
    type: 'patrocinio',
    name: 'Comunidad',
    description: 'Patrocinio nivel Comunidad',
    priceUSD: 62.07,
    stripePriceId: process.env.STRIPE_PRICE_PATROCINIO_COMUNIDAD ?? '',
  },
  {
    id: 'transforma',
    type: 'patrocinio',
    name: 'Transforma',
    description: 'Patrocinio nivel Transforma',
    priceUSD: 155.17,
    stripePriceId: process.env.STRIPE_PRICE_PATROCINIO_TRANSFORMA ?? '',
  },
]

// ── Alias para compatibilidad con código existente ────────────
export const STANDARD_PLANS = ESENCIAL_PLANS.filter(p => p.type === 'paid')
export const VALORA_PLANS    = ESENCIAL_VALORA_PLANS

// ── Utilidades ────────────────────────────────────────────────

/** Calcula el precio para N pacientes al precio unitario del tier */
export function calcUnitPrice(slots: number, tier: PlanTier = 'esencial'): number {
  const unitPrice = tier === 'clinico' ? UNIT_PRICE_CLINICO : UNIT_PRICE_ESENCIAL
  return Math.round(slots * unitPrice * 100) / 100
}

/** Busca un plan (cualquier tier) por su Stripe price ID */
export function getPlanByStripeId(priceId: string): Plan | undefined {
  return [
    ...ESENCIAL_PLANS,
    ...ESENCIAL_VALORA_PLANS,
    ...CLINICO_PLANS,
    ...CLINICO_VALORA_PLANS,
  ].find(p => p.stripePriceId === priceId)
}

/** Devuelve los patient_slots de un plan dado su id */
export function getSlotsForPlan(planId: string, customSlots?: number): number {
  if (planId.endsWith('_unit') || planId === 'unit') return customSlots ?? 1
  const all = [
    ...ESENCIAL_PLANS,
    ...ESENCIAL_VALORA_PLANS,
    ...CLINICO_PLANS,
    ...CLINICO_VALORA_PLANS,
  ]
  const plan = all.find(p => p.id === planId)
  return typeof plan?.patientSlots === 'number' ? plan.patientSlots : 1
}
