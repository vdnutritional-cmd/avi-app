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
  COMPANION_PLANS,
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
  planType: 'paid' | 'valora' | 'unit' | 'companion'
  patientSlots: number
}

function resolvePlan(planId: string, requestedSlots?: number): ResolvedPlan | null {
  // Normalizar 'unit' (legacy) → 'esencial_unit'
  const id = planId === 'unit' ? 'esencial_unit' : planId

  // Companion plans (gratuitos, sin Stripe)
  const companionPlan = COMPANION_PLANS.find(p => p.id === id)
  if (companionPlan) {
    const slots = typeof companionPlan.patientSlots === 'number' ? companionPlan.patientSlots : 1
    return { priceId: '', quantity: 1, planType: 'companion', patientSlots: slots }
  }

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
    const { planId, slots, convenioCode, empresaIds } = body as {
      planId: string
      slots?: number
      convenioCode?: string
      empresaIds?: string[]
    }

    if (!planId) {
      return NextResponse.json({ error: 'planId requerido' }, { status: 400 })
    }

    // 3. Resolver plan → price ID + cantidad
    const resolved = resolvePlan(planId, slots)
    if (!resolved) {
      return NextResponse.json({ error: `Plan "${planId}" no encontrado` }, { status: 400 })
    }

    // 3b. Validar código CONVENIO si el plan lo requiere (valora o companion)
    const requiresCode = resolved.planType === 'valora' || resolved.planType === 'companion'
    let convenioCodeId = ''

    if (requiresCode) {
      if (!convenioCode) {
        return NextResponse.json({ error: 'Este plan requiere un código CONVENIO autorizado.' }, { status: 403 })
      }
      const codeClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: codeRow } = await (codeClient as any)
        .from('convenio_codes')
        .select('id, plan_id, used_by, expires_at, is_active')
        .eq('code', convenioCode.toUpperCase())
        .maybeSingle() as { data: { id: string; plan_id: string | null; used_by: string | null; expires_at: string | null; is_active: boolean } | null }

      if (!codeRow || !codeRow.is_active) {
        return NextResponse.json({ error: 'Código CONVENIO inválido o inactivo.' }, { status: 403 })
      }
      if (codeRow.used_by) {
        return NextResponse.json({ error: 'Este código ya fue utilizado.' }, { status: 403 })
      }
      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Este código ha expirado.' }, { status: 403 })
      }
      if (codeRow.plan_id && codeRow.plan_id !== planId) {
        return NextResponse.json({ error: 'Este código no es válido para el plan seleccionado.' }, { status: 403 })
      }

      // Planes CONVENIO con pago (cualquier empresa): el código se marca como usado
      // y el terapeuta se liga a sus empresas en el webhook, solo cuando Stripe
      // confirma el pago. Aquí solo se valida y se pasa el id del código en metadata.
      convenioCodeId = codeRow.id

      // 3c. Companion plans — activar sin Stripe (Opción B: coexiste con otros planes)
      if (resolved.planType === 'companion') {
        // Marcar código como usado — solo si sigue libre (evita doble uso simultáneo)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: claimed } = await (codeClient as any)
          .from('convenio_codes')
          .update({ used_by: user.id, used_at: new Date().toISOString() })
          .eq('id', codeRow.id)
          .is('used_by', null)
          .select('id') as { data: { id: string }[] | null }

        if (!claimed || claimed.length === 0) {
          return NextResponse.json({ error: 'Este código ya fue utilizado.' }, { status: 403 })
        }

        // Libera el código si la activación falla, para que el terapeuta pueda reintentar
        const releaseCode = async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (codeClient as any)
            .from('convenio_codes')
            .update({ used_by: null, used_at: null })
            .eq('id', codeRow.id)
            .eq('used_by', user.id)
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://go.avi-app.com.mx'

        // Verificar si ya tiene un plan activo distinto de companion
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: subActual } = await (codeClient as any)
          .from('subscriptions')
          .select('status, plan')
          .eq('therapist_id', user.id)
          .maybeSingle() as { data: { status: string; plan: string } | null }

        const tieneOtroPlanActivo =
          subActual &&
          ['active', 'trialing', 'free_approved'].includes(subActual.status) &&
          subActual.plan !== 'companion'

        if (!tieneOtroPlanActivo) {
          // Sin plan previo (o solo companion): crear/actualizar suscripción companion
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: subError } = await (codeClient as any)
            .from('subscriptions')
            .upsert(
              {
                therapist_id:           user.id,
                plan:                   'companion',
                tier:                   'clinico',   // acceso completo Esencial + Clínico
                status:                 'active',
                patient_slots:          resolved.patientSlots,
                stripe_customer_id:     null,
                stripe_subscription_id: null,
                stripe_price_id:        null,
                billing_cycle_start:    new Date().toISOString(),
              },
              { onConflict: 'therapist_id' }
            )
          if (subError) {
            console.error('[checkout/companion] Error al activar suscripción:', subError)
            await releaseCode()
            return NextResponse.json({ error: 'Error al activar el plan.' }, { status: 500 })
          }
        }
        // Si tiene otro plan activo (valora, regular…): solo se crea el bundle,
        // la suscripción principal queda intacta.

        // Crear bloque de cupo companion (empresa_id=null → cubre pacientes sin CONVENIO)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: bundleError } = await (codeClient as any).from('therapist_slot_bundles').insert({
          therapist_id:  user.id,
          source_type:   'convenio',   // activado mediante código CONVENIO
          empresa_id:    null,         // null = pacientes independientes (sin empresa)
          patient_slots: resolved.patientSlots,
          discount_pct:  100,
          status:        'active',
          stripe_sub_id: null,
        })
        if (bundleError) {
          console.error('[checkout/companion] Error al crear bundle:', bundleError)
          await releaseCode()
          return NextResponse.json({ error: 'Error al activar el plan.' }, { status: 500 })
        }

        console.log(
          `[checkout/companion] ✅ ${planId} — terapeuta: ${user.id}, slots: ${resolved.patientSlots}` +
          (tieneOtroPlanActivo ? ` (bundle adicional, suscripción ${subActual!.plan} preservada)` : ' (suscripción companion creada)')
        )
        return NextResponse.json({ url: `${appUrl}/therapist/dashboard?checkout=success` })
      }
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
    // Siempre usar el dominio del app (go.avi-app.com.mx), nunca el sitio marketing
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://go.avi-app.com.mx'

    // IVA manual 16% inclusivo (built-in en el precio).
    // Se aplica solo si está configurado el env var; si no, se omite.
    const taxRateId = process.env.STRIPE_TAX_RATE_IVA_16

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: resolved.priceId,
          quantity: resolved.quantity,
          ...(taxRateId ? { tax_rates: [taxRateId] } : {}),
        },
      ],
      success_url: `${appUrl}/therapist/dashboard?checkout=success`,
      cancel_url: `${appUrl}/therapist/dashboard`,
      metadata: {
        therapist_id: user.id,
        plan_id: planId,
        plan_type: resolved.planType,
        patient_slots: String(resolved.patientSlots),
        empresa_ids: empresaIds && empresaIds.length > 0 ? empresaIds.join(',') : '',
        convenio_code_id: convenioCodeId,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout] Error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
