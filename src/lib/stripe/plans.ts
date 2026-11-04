// ─────────────────────────────────────────────────────────────
// AVI — Planes y precios
// Dos tiers: Esencial y Clínico
// Cada tier tiene: precio unitario + paquetes 5/10/20/30/40 + VALORA 10/20
// Patrocinios: Semilla, Esperanza, Comunidad, Transforma
// ─────────────────────────────────────────────────────────────

export type PlanType = 'unit' | 'paid' | 'valora' | 'free' | 'patrocinio' | 'companion'
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
  priceUSD: number
  stripePriceId: string
  isPerPatient?: boolean    // true = tarifa plana × cantidad de pacientes (ej. Legado)
}

// ── Precios unitarios base ────────────────────────────────────
export const UNIT_PRICE_ESENCIAL = 3.95   // 4 nov 2026 (antes 2.85)
export const UNIT_PRICE_CLINICO  = 4.49   // 4 nov 2026 (antes 3.85)

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
    priceUSD: 19.42,
    unitPriceUSD: 3.88,
    savingsVsUnit: 2,   // vs $19.75 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_PACK5 ?? '',
  },
  {
    id: 'esencial_pack10',
    type: 'paid',
    tier: 'esencial',
    name: 'Esencial 10',
    description: '10 pacientes activos por mes',
    patientSlots: 10,
    priceUSD: 38.15,
    unitPriceUSD: 3.82,
    savingsVsUnit: 3,   // vs $39.50 unitario
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
    priceUSD: 74.92,
    unitPriceUSD: 3.75,
    savingsVsUnit: 5,   // vs $79.00 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_PACK20 ?? '',
  },
  {
    id: 'esencial_pack30',
    type: 'paid',
    tier: 'esencial',
    name: 'Esencial 30',
    description: '30 pacientes activos por mes',
    patientSlots: 30,
    priceUSD: 110.31,
    unitPriceUSD: 3.68,
    savingsVsUnit: 7,   // vs $118.50 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_PACK30 ?? '',
  },
  {
    id: 'esencial_pack40',
    type: 'paid',
    tier: 'esencial',
    name: 'Esencial 40',
    description: '40 pacientes activos por mes',
    patientSlots: 40,
    priceUSD: 144.33,
    unitPriceUSD: 3.61,
    savingsVsUnit: 9,   // vs $158.00 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_PACK40 ?? '',
  },
]

// ── Paquetes en CONVENIO — Esencial ──────────────────────────
export const ESENCIAL_VALORA_PLANS: Plan[] = [
  {
    id: 'esencial_valora10',
    type: 'valora',
    tier: 'esencial',
    name: 'CONVENIO Esencial 10',
    description: '10 pacientes — Precio especial asesores en CONVENIO',
    patientSlots: 10,
    priceUSD: 35.39,
    unitPriceUSD: 3.54,
    savingsVsUnit: 10,   // vs $39.50 unitario
    stripePriceId: process.env.STRIPE_PRICE_ESENCIAL_VALORA10 ?? '',
    isValora: true,
  },
  {
    id: 'esencial_valora20',
    type: 'valora',
    tier: 'esencial',
    name: 'CONVENIO Esencial 20',
    description: '20 pacientes — Precio especial asesores en CONVENIO',
    patientSlots: 20,
    priceUSD: 69.41,
    unitPriceUSD: 3.47,
    savingsVsUnit: 12,   // vs $79.00 unitario
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
    priceUSD: 22.03,
    unitPriceUSD: 4.41,
    savingsVsUnit: 2,    // vs $22.45 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_PACK5 ?? '',
  },
  {
    id: 'clinico_pack10',
    type: 'paid',
    tier: 'clinico',
    name: 'Clínico 10',
    description: '10 pacientes activos por mes',
    patientSlots: 10,
    priceUSD: 43.29,
    unitPriceUSD: 4.33,
    savingsVsUnit: 4,   // vs $44.90 unitario
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
    priceUSD: 85.01,
    unitPriceUSD: 4.25,
    savingsVsUnit: 5,   // vs $89.80 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_PACK20 ?? '',
  },
  {
    id: 'clinico_pack30',
    type: 'paid',
    tier: 'clinico',
    name: 'Clínico 30',
    description: '30 pacientes activos por mes',
    patientSlots: 30,
    priceUSD: 125.18,
    unitPriceUSD: 4.17,
    savingsVsUnit: 7,   // vs $134.70 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_PACK30 ?? '',
  },
  {
    id: 'clinico_pack40',
    type: 'paid',
    tier: 'clinico',
    name: 'Clínico 40',
    description: '40 pacientes activos por mes',
    patientSlots: 40,
    priceUSD: 163.78,
    unitPriceUSD: 4.09,
    savingsVsUnit: 9,   // vs $179.60 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_PACK40 ?? '',
  },
]

// ── Paquetes en CONVENIO — Clínico ───────────────────────────
export const CLINICO_VALORA_PLANS: Plan[] = [
  {
    id: 'clinico_valora10',
    type: 'valora',
    tier: 'clinico',
    name: 'CONVENIO Clínico 10',
    description: '10 pacientes — Precio especial asesores en CONVENIO',
    patientSlots: 10,
    priceUSD: 40.16,
    unitPriceUSD: 4.02,
    savingsVsUnit: 11,   // vs $44.90 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_VALORA10 ?? '',
    isValora: true,
  },
  {
    id: 'clinico_valora20',
    type: 'valora',
    tier: 'clinico',
    name: 'CONVENIO Clínico 20',
    description: '20 pacientes — Precio especial asesores en CONVENIO',
    patientSlots: 20,
    priceUSD: 78.76,
    unitPriceUSD: 3.94,
    savingsVsUnit: 12,   // vs $89.80 unitario
    stripePriceId: process.env.STRIPE_PRICE_CLINICO_VALORA20 ?? '',
    isValora: true,
    highlight: true,
  },
]

// ── Paquetes AVI Therapy Companion (CONVENIO gratuitos) ──────
// Sin costo mensual — acceso completo (Esencial + Clínico)
// Se activan mediante un código de un solo uso con fecha de vigencia.
// No pasan por Stripe; la suscripción se activa directamente en Supabase.
export const COMPANION_PLANS: Plan[] = [
  {
    id: 'companion_5',
    type: 'companion',
    tier: 'clinico',
    name: 'AVI Therapy Companion 5',
    description: '5 pacientes — AVI-Esencial + AVI-Clínico incluidos. Sin costo mensual. Requiere código de activación con fecha de vigencia.',
    patientSlots: 5,
    priceUSD: 0,
    unitPriceUSD: 0,
    stripePriceId: '',
  },
  {
    id: 'companion_10',
    type: 'companion',
    tier: 'clinico',
    name: 'AVI Therapy Companion 10',
    description: '10 pacientes — AVI-Esencial + AVI-Clínico incluidos. Sin costo mensual. Requiere código de activación con fecha de vigencia.',
    patientSlots: 10,
    priceUSD: 0,
    unitPriceUSD: 0,
    stripePriceId: '',
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
    id: 'encuentro',
    type: 'patrocinio',
    name: 'Encuentro',
    description: 'Patrocinio nivel Encuentro',
    priceUSD: 110.00,
    stripePriceId: process.env.STRIPE_PRICE_PATROCINIO_ENCUENTRO ?? '',
  },
  {
    id: 'transforma',
    type: 'patrocinio',
    name: 'Transforma',
    description: 'Patrocinio nivel Transforma',
    priceUSD: 155.17,
    stripePriceId: process.env.STRIPE_PRICE_PATROCINIO_TRANSFORMA ?? '',
  },
  {
    id: 'legado',
    type: 'patrocinio',
    name: 'Legado',
    description: 'Patrocinio nivel Legado — $3.60 USD por paciente patrocinado',
    priceUSD: 3.60,
    stripePriceId: process.env.STRIPE_PRICE_PATROCINIO_LEGADO ?? '',
    isPerPatient: true,     // quantity = número de pacientes a patrocinar
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
    ...COMPANION_PLANS,
  ]
  const plan = all.find(p => p.id === planId)
  return typeof plan?.patientSlots === 'number' ? plan.patientSlots : 1
}
