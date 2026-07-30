// ─────────────────────────────────────────────────────────────
// POST /api/stripe/webhook
// Recibe eventos de Stripe y actualiza la tabla subscriptions.
//
// Eventos manejados:
//   checkout.session.completed   → activa la suscripción
//   customer.subscription.updated → sincroniza el estado
//   customer.subscription.deleted → cancela la suscripción
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Usar service role para bypassear RLS en actualizaciones del webhook
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mapeo de status de Stripe → status en nuestra BD
const STRIPE_STATUS_MAP: Record<string, string> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'active',       // sigue activo pero con pago pendiente
  canceled: 'cancelled',
  unpaid: 'inactive',
  incomplete: 'inactive',
  incomplete_expired: 'inactive',
  paused: 'inactive',
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  // 1. Verificar firma del webhook
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[webhook] Firma inválida:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  // 2. Despachar por tipo de evento
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      default:
        // Evento no manejado — OK, solo lo ignoramos
        break
    }
  } catch (err) {
    console.error(`[webhook] Error procesando "${event.type}":`, err)
    return NextResponse.json({ error: 'Error procesando evento' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ── Derivar tier a partir del plan_id o price_id ─────────────
function tierFromPlanId(planId: string): 'esencial' | 'clinico' {
  return planId.startsWith('clinico_') ? 'clinico' : 'esencial'
}

const CLINICO_PRICE_IDS = [
  process.env.STRIPE_PRICE_CLINICO_UNIT,
  process.env.STRIPE_PRICE_CLINICO_PACK5,
  process.env.STRIPE_PRICE_CLINICO_PACK10,
  process.env.STRIPE_PRICE_CLINICO_PACK20,
  process.env.STRIPE_PRICE_CLINICO_PACK30,
  process.env.STRIPE_PRICE_CLINICO_PACK40,
  process.env.STRIPE_PRICE_CLINICO_VALORA10,
  process.env.STRIPE_PRICE_CLINICO_VALORA20,
].filter(Boolean)

function tierFromPriceId(priceId: string): 'esencial' | 'clinico' {
  return CLINICO_PRICE_IDS.includes(priceId) ? 'clinico' : 'esencial'
}

// ── checkout.session.completed ────────────────────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const therapistId = session.metadata?.therapist_id
  if (!therapistId) {
    console.error('[webhook] checkout.session.completed sin therapist_id en metadata')
    return
  }

  const planType  = session.metadata?.plan_type ?? 'paid'
  const planId    = session.metadata?.plan_id ?? ''
  const patientSlots = parseInt(session.metadata?.patient_slots ?? '5', 10)
  const tier      = tierFromPlanId(planId)

  const customerId     = resolveId(session.customer)
  const subscriptionId = resolveId(session.subscription)

  // Obtener el price_id real desde la suscripción de Stripe
  let stripePriceId = ''
  if (subscriptionId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
      stripePriceId = stripeSub.items.data[0]?.price.id ?? ''
    } catch (e) {
      console.error('[webhook] No se pudo recuperar la suscripción de Stripe:', e)
    }
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        therapist_id:           therapistId,
        plan:                   planType,
        tier,
        status:                 'active',
        patient_slots:          patientSlots,
        stripe_customer_id:     customerId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id:        stripePriceId,
        billing_cycle_start:    new Date().toISOString(),
      },
      { onConflict: 'therapist_id' }
    )

  if (error) {
    console.error('[webhook] Error al activar suscripción:', error)
    throw error
  }

  console.log(`[webhook] ✅ Suscripción activada — terapeuta: ${therapistId}, plan: ${planId}, tier: ${tier}, slots: ${patientSlots}`)
}

// ── customer.subscription.updated ────────────────────────────
async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const customerId = resolveId(sub.customer)
  const newStatus  = STRIPE_STATUS_MAP[sub.status] ?? 'inactive'
  const priceId    = sub.items.data[0]?.price.id ?? ''
  const tier       = priceId ? tierFromPriceId(priceId) : undefined

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: newStatus,
      ...(priceId ? { stripe_price_id: priceId } : {}),
      ...(tier    ? { tier }                      : {}),
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('[webhook] Error al actualizar suscripción:', error)
    throw error
  }

  console.log(`[webhook] 🔄 Suscripción actualizada — customer: ${customerId}, status: ${newStatus}`)
}

// ── customer.subscription.deleted ────────────────────────────
async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = resolveId(sub.customer)

  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('[webhook] Error al cancelar suscripción:', error)
    throw error
  }

  console.log(`[webhook] ❌ Suscripción cancelada — customer: ${customerId}`)
}

// ── Helper ────────────────────────────────────────────────────
function resolveId(obj: string | { id: string } | null | undefined): string {
  if (!obj) return ''
  return typeof obj === 'string' ? obj : obj.id
}
