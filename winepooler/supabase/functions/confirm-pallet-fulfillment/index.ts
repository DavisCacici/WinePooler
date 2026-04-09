import { createClient } from '@supabase/supabase-js'

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

    // 2. Parse request
    const { palletId } = await req.json()
    if (!palletId) {
      return new Response(JSON.stringify({ error: 'Missing palletId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_SECRET_KEY!,
    )

    // 3. Verify pallet belongs to calling winery
    const { data: pallet, error: palletError } = await supabaseAdmin
      .from('virtual_pallets')
      .select('id, state, winery_id')
      .eq('id', palletId)
      .single()

    if (palletError || !pallet) {
      return new Response(JSON.stringify({ error: 'Pallet not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify ownership
    const { data: wineryProfile } = await supabaseAdmin
      .from('winery_profiles')
      .select('id')
      .eq('id', pallet.winery_id)
      .eq('user_id', user.id)
      .single()

    if (!wineryProfile) {
      return new Response(JSON.stringify({ error: 'Not authorized for this pallet' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Transition to completed
    if (pallet.state === 'frozen') {
      const { error: updateError } = await supabaseAdmin
        .from('virtual_pallets')
        .update({ state: 'completed', updated_at: new Date().toISOString() })
        .eq('id', palletId)
        .eq('state', 'frozen')

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to confirm fulfillment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (pallet.state !== 'completed') {
      return new Response(
        JSON.stringify({ error: `Pallet is in '${pallet.state}' state, expected 'frozen'` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Trigger payout processing
    const payoutUrl = `${process.env.VITE_SUPABASE_URL}/functions/v1/process-pallet-payout`
    const payoutResponse = await fetch(payoutUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ palletId }),
    })

    const payoutResult = await payoutResponse.json()

    return new Response(
      JSON.stringify({
        fulfillmentStatus: 'completed',
        payoutStatus: payoutResult.status ?? payoutResult.error ?? 'unknown',
        payoutDetails: payoutResult,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('confirm-pallet-fulfillment error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
