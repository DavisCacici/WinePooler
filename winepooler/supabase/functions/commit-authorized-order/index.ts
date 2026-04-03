import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-04-30.basil',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
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
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
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
    const { palletId, quantity, paymentIntentId, wineLabel, notes } = await req.json()
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
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
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
        const captureUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/capture-frozen-pallet-payments`
        await fetch(captureUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
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
})
