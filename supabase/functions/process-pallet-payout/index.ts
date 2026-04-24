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

    // 2. Parse request
    const { palletId } = await req.json()
    if (!palletId) {
      return new Response(JSON.stringify({ error: 'Missing palletId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use service-role client for admin operations
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_SECRET_KEY!,
    )

    // 3. Get payout summary
    const { data: summaryRows, error: summaryError } = await supabaseAdmin.rpc(
      'get_pallet_payout_summary',
      { p_pallet_id: palletId }
    )

    if (summaryError || !summaryRows || summaryRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Pallet not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const summary = summaryRows[0] as {
      pallet_id: string
      winery_id: string
      currency: string
      gross_cents: number
      captured_count: number
      is_eligible: boolean
    }

    if (!summary.is_eligible) {
      return new Response(
        JSON.stringify({ error: 'Pallet is not eligible for payout', captured_count: summary.captured_count }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Verify caller is the winery owner
    const { data: wineryProfile, error: wineryError } = await supabaseAdmin
      .from('winery_profiles')
      .select('id, stripe_connect_account_id')
      .eq('id', summary.winery_id)
      .eq('user_id', user.id)
      .single()

    if (wineryError || !wineryProfile) {
      return new Response(JSON.stringify({ error: 'Not authorized for this pallet' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!wineryProfile.stripe_connect_account_id) {
      return new Response(
        JSON.stringify({ error: 'Winery has no Stripe Connect account linked' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Get commission rate
    const { data: feeRows } = await supabaseAdmin
      .from('platform_fees')
      .select('commission_bps')
      .order('effective_from', { ascending: false })
      .limit(1)

    const commissionBps = feeRows?.[0]?.commission_bps ?? 500 // default 5%
    const commissionCents = Math.floor((summary.gross_cents * commissionBps) / 10000)
    const netCents = summary.gross_cents - commissionCents

    // 6. Claim payout (idempotent)
    const { data: claimRows, error: claimError } = await supabaseAdmin.rpc(
      'claim_pallet_for_payout',
      {
        p_pallet_id: palletId,
        p_winery_id: summary.winery_id,
        p_gross_cents: summary.gross_cents,
        p_commission_cents: commissionCents,
        p_net_cents: netCents,
        p_currency: summary.currency,
        p_commission_bps: commissionBps,
      }
    )

    if (claimError || !claimRows || claimRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to claim payout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const claim = claimRows[0] as { payout_id: string; claim_status: string }

    if (claim.claim_status === 'already_paid') {
      return new Response(
        JSON.stringify({ status: 'already_paid', payoutId: claim.payout_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Create Stripe Transfer with idempotency key
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: netCents,
          currency: summary.currency,
          destination: wineryProfile.stripe_connect_account_id,
          metadata: {
            pallet_id: palletId,
            payout_id: claim.payout_id,
            gross_cents: String(summary.gross_cents),
            commission_cents: String(commissionCents),
            commission_bps: String(commissionBps),
          },
        },
        {
          idempotencyKey: `pallet_payout:${palletId}`,
        }
      )

      // 8. Mark payout as paid
      await supabaseAdmin
        .from('pallet_payouts')
        .update({
          status: 'paid',
          stripe_transfer_id: transfer.id,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', claim.payout_id)

      // 9. Insert payout items from captured authorizations
      const { data: authRows } = await supabaseAdmin
        .from('payment_authorizations')
        .select('id, amount_cents')
        .eq('pallet_id', palletId)
        .eq('status', 'captured')

      if (authRows && authRows.length > 0) {
        const payoutItems = authRows.map((auth: { id: string; amount_cents: number }) => ({
          payout_id: claim.payout_id,
          payment_authorization_id: auth.id,
          amount_cents: auth.amount_cents,
        }))

        await supabaseAdmin.from('pallet_payout_items').insert(payoutItems)
      }

      return new Response(
        JSON.stringify({
          status: 'paid',
          payoutId: claim.payout_id,
          stripeTransferId: transfer.id,
          grossCents: summary.gross_cents,
          commissionCents,
          netCents,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (stripeError: any) {
      // 10. Mark payout as failed
      await supabaseAdmin
        .from('pallet_payouts')
        .update({
          status: 'failed',
          failure_reason: stripeError?.message ?? 'Stripe transfer failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', claim.payout_id)

      return new Response(
        JSON.stringify({
          error: 'Payout transfer failed',
          reason: stripeError?.message ?? 'Unknown Stripe error',
          payoutId: claim.payout_id,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (err) {
    console.error('process-pallet-payout error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
