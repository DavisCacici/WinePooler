import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-04-30.basil',
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // 1. Verify Stripe signature
    const body = await req.text()
    const signature = req.headers.get('Stripe-Signature')

    if (!signature) {
      return new Response('Missing Stripe-Signature header', { status: 400 })
    }

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response('Webhook signature verification failed', { status: 400 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 2. Handle relevant events
    switch (event.type) {
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent
        await supabaseAdmin
          .from('payment_authorizations')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', pi.id)
        break
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        await supabaseAdmin
          .from('payment_authorizations')
          .update({
            status: 'captured',
            captured_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', pi.id)
        break
      }

      default:
        // Ignore payout, transfer, and other events — not in scope for Story 5.1
        break
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('stripe-webhook error:', err)
    return new Response('Internal server error', { status: 500 })
  }
})
