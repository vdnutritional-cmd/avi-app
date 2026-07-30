// ─────────────────────────────────────────────────────────────
// POST /api/stripe/checkout
// Crea una Stripe Checkout Session y devuelve { url } para redirigir al terapeuta.
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  ESENCIAL_PLANS,
  ESENCIAL_VALORA_PLANS,
  CLINICO_PLANS,
  CLINICO_VALORA_PLANS,
  PATROCINIO_PLANS,
} from '@/lib/stripe/plans'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// ── Todos los planes indexados por id ────────────────────────
const ALL_THERAPY_PLANS = [
  ...ESENCIAL_PLANS,
  ...ESENCIAL_VALORA_PLANS,
  ...CLINICO_PLANS,
  ...CLINICO_VALORA_PLANS,
]

interface ResolvedPlan {
  priceId: string
  quantity: number
  planType: 'paid' | 'valora' | 'unit'
  patientSlots: number
}

function resolvePlan(planId: string, requestedSlots?: number): ResolvedPlan | null {
  // Normalizar 'unit' (legacy) → 'esencial_unit'
  const id = planId === 'unit' ? 'esencial_unit' : planId

  // Planes unitarios: quantity = número de pacientes solicitados
  if (id.endsWith('_unit')) {
    const plan = ALL_THERAPY_PLANS.find(p => p.id === id)
    if (!plan || !plan.stripePriceId) return null
    const qty = Math.max(1, requestedSlots ?? 1)
    return { priceId: plan.stripePriceId, quantity: qty, planType: 'unit', patientSlots: qty }
  }

  // Paquetes terapéuticos (esencial/clinico pack + valora)
  const plan = ALL_THERAPY_PLANS.find(p => p.id === id)
  if (plan && plan.stripePriceId) {
    const slots = typeof plan.patientSlots === 'number' ? plan.patientSlots : 1
    const planType = plan.type === 'valora' ? 'valora' : 'paid'
    return { priceId: plan.stripePriceId, quantity: 1, planType, patientSlots: slots }
  }

  // Patrocinios
  const patrocinio = PATROCINIO_PLANS.find(p => p.id === id)
  if (patrocinio && patrocinio.stripePriceId) {
    return { priceId: patrocinio.stripePriceId, quantity: 1, planType: 'paid', patientSlots: 0 }
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticar terapeuta
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Parsear body
    const body = await req.json()
    const { planId, slots } = body as { planId: string; slots?: number }

    if (!planId) {
      return NextResponse.json({ error: 'planId requerido' }, { status: 400 })
    }

    // 3. Resolver plan → price ID + cantidad
    const resolved = resolvePlan(planId, slots)
    if (!resolved) {
      return NextResponse.json({ error: `Plan "${planId}" no encontrado` }, { status: 400 })
    }

    // 4. Obtener o crear cliente Stripe vinculado al terapeuta
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existingSub } = await serviceClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('therapist_id', user.id)
      .maybeSingle()

    let customerId = existingSub?.stripe_customer_id as string | undefined

    if (!customerId) {
      // Buscar si ya existe un customer con este email en Stripe
      const existing = await stripe.customers.list({ email: user.email, limit: 1 })
      if (existing.data.length > 0) {
        customerId = existing.data[0].id
      } else {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: { therapist_id: user.id },
        })
        customerId = customer.id
      }
    }

    // 5. Crear Checkout Session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://avi-app.com.mx'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: resolved.priceId,
          quantity: resolved.quantity,
        },
      ],
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto' },
      success_url: `${appUrl}/therapist/dashboard?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      metadata: {
        therapist_id: user.id,
        plan_id: planId,
        plan_type: resolved.planType,
        patient_slots: String(resolved.patientSlots),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout] Error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
