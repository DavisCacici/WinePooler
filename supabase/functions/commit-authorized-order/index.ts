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

    // 2. Parse request body
    const { palletId, quantity, paymentIntentId, wineLabel, notes, unitType, unitQuantity } = await req.json()
    if (!palletId || !quantity || !paymentIntentId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: palletId, quantity, paymentIntentId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Retrieve PaymentIntent from Stripe and verify
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'requires_capture') {
      return new Response(JSON.stringify({ error: `PaymentIntent status is '${paymentIntent.status}', expected 'requires_capture'` }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify metadata matches authenticated buyer and pallet
    if (paymentIntent.metadata.pallet_id !== palletId ||
        paymentIntent.metadata.buyer_id !== user.id ||
        paymentIntent.metadata.quantity !== String(quantity)) {
      return new Response(JSON.stringify({ error: 'PaymentIntent metadata mismatch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Call the authorization-aware RPC using service-role client
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_SECRET_KEY!,
    )

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'add_order_with_authorization_and_increment',
      {
        p_pallet_id: palletId,
        p_buyer_id: user.id,
        p_quantity: quantity,
        p_payment_intent_id: paymentIntentId,
        p_authorized_amount_cents: paymentIntent.amount,
        p_currency: paymentIntent.currency,
        p_capture_before: null,
        p_wine_label: wineLabel ?? null,
        p_notes: notes ?? null,
        p_unit_type: unitType ?? 'bottle',
        p_unit_quantity: unitQuantity ?? null,
      }
    )

    // 5. On RPC failure: cancel the PaymentIntent immediately
    if (rpcError) {
      console.error('RPC error, canceling PaymentIntent:', rpcError.message)
      try {
        await stripe.paymentIntents.cancel(paymentIntentId)
      } catch (cancelErr) {
        console.error('Failed to cancel PaymentIntent:', cancelErr)
      }

      const isPalletConflict = rpcError.message?.includes('not open')
      return new Response(
        JSON.stringify({
          error: isPalletConflict
            ? 'Pallet is no longer available — authorization has been released'
            : 'Order commit failed — authorization has been released',
          code: isPalletConflict ? 'PALLET_CONFLICT' : 'COMMIT_FAILED',
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 6. If pallet froze, trigger capture for all authorized payments
    if (rpcResult.new_state === 'frozen') {
      try {
        const captureUrl = `${process.env.VITE_SUPABASE_URL}/functions/v1/capture-frozen-pallet-payments`
        await fetch(captureUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VITE_SUPABASE_SECRET_KEY}`,
          },
          body: JSON.stringify({ palletId }),
        })
      } catch (captureErr) {
        // Capture is async — log but don't fail the commit response
        console.error('Failed to invoke capture function:', captureErr)
      }
    }

    return new Response(
      JSON.stringify({
        orderId: rpcResult.order_id,
        authorizationId: rpcResult.authorization_id,
        newCount: rpcResult.new_count,
        newState: rpcResult.new_state,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('commit-authorized-order error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
