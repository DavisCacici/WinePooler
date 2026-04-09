import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.VITE_STRIPE_SECRET_KEY!)

const webhookSecret = process.env.VITE_STRIPE_WEBHOOK_SECRET!

export default async function handler(req: Request): Promise<Response> {
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
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_SECRET_KEY!,
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
}
