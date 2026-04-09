import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Validate JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Parse and validate request body
    const { palletId, quantity } = await req.json()
    if (!palletId || !quantity || typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
      return new Response(JSON.stringify({ error: 'Invalid palletId or quantity' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Load pallet pricing
    const { data: pallet, error: palletError } = await supabase
      .from('virtual_pallets')
      .select('id, state, bulk_price_per_bottle')
      .eq('id', palletId)
      .single()

    if (palletError || !pallet) {
      return new Response(JSON.stringify({ error: 'Pallet not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (pallet.state !== 'open') {
      return new Response(JSON.stringify({ error: 'Pallet is not open' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!pallet.bulk_price_per_bottle || pallet.bulk_price_per_bottle <= 0) {
      return new Response(JSON.stringify({ error: 'Pallet has no valid pricing' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Compute amount in cents (EUR)
    const amountCents = Math.round(quantity * pallet.bulk_price_per_bottle * 100)

    // 5. Create manual-capture PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      capture_method: 'manual',
      metadata: {
        pallet_id: palletId,
        buyer_id: user.id,
        quantity: String(quantity),
      },
    })

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountCents,
        captureBefore: paymentIntent.latest_charge
          ? undefined
          : undefined, // Stripe manual-capture auth validity is ~7 days
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('create-escrow-payment-intent error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
