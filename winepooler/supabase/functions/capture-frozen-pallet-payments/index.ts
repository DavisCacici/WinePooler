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
    // This function is invoked server-side with service-role key
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { palletId } = await req.json()
    if (!palletId) {
      return new Response(JSON.stringify({ error: 'Missing palletId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Atomically claim authorized → capture_pending
    const { data: claims, error: claimError } = await supabaseAdmin.rpc(
      'claim_authorized_payments_for_capture',
      { p_pallet_id: palletId }
    )

    if (claimError) {
      console.error('Claim error:', claimError)
      return new Response(JSON.stringify({ error: 'Failed to claim payments for capture' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!claims || claims.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No authorized payments to capture', captured: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Capture each PaymentIntent with idempotency key
    const results: { id: string; status: 'captured' | 'capture_failed'; error?: string }[] = []

    for (const claim of claims) {
      try {
        await stripe.paymentIntents.capture(claim.stripe_payment_intent_id, {}, {
          idempotencyKey: `capture-${claim.authorization_id}`,
        })

        // Mark as captured
        await supabaseAdmin
          .from('payment_authorizations')
          .update({
            status: 'captured',
            captured_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', claim.authorization_id)

        results.push({ id: claim.authorization_id, status: 'captured' })
      } catch (captureErr: unknown) {
        const errorMessage = captureErr instanceof Error ? captureErr.message : 'Unknown capture error'
        console.error(`Capture failed for ${claim.stripe_payment_intent_id}:`, errorMessage)

        // Mark as capture_failed
        await supabaseAdmin
          .from('payment_authorizations')
          .update({
            status: 'capture_failed',
            last_error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', claim.authorization_id)

        results.push({ id: claim.authorization_id, status: 'capture_failed', error: errorMessage })
      }
    }

    const captured = results.filter(r => r.status === 'captured').length
    const failed = results.filter(r => r.status === 'capture_failed').length

    return new Response(
      JSON.stringify({ captured, failed, details: results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('capture-frozen-pallet-payments error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
