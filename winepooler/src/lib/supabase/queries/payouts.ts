import { supabase } from '../client'

export interface PalletPayout {
  id: string
  pallet_id: string
  winery_id: string
  stripe_transfer_id: string | null
  gross_amount_cents: number
  commission_amount_cents: number
  net_amount_cents: number
  currency: string
  commission_bps: number
  status: 'pending' | 'processing' | 'paid' | 'failed'
  failure_reason: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}

export interface PayoutItem {
  id: string
  payout_id: string
  payment_authorization_id: string
  amount_cents: number
  created_at: string
}

export interface ConfirmFulfillmentResponse {
  fulfillmentStatus: string
  payoutStatus: string
  payoutDetails: Record<string, unknown>
}

export const getWineryPayouts = async (wineryId: string): Promise<PalletPayout[]> => {
  const { data, error } = await supabase
    .from('pallet_payouts')
    .select('*')
    .eq('winery_id', wineryId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export const getPalletPayoutDetail = async (palletId: string): Promise<{
  payout: PalletPayout | null
  items: PayoutItem[]
}> => {
  const { data: payout, error: payoutError } = await supabase
    .from('pallet_payouts')
    .select('*')
    .eq('pallet_id', palletId)
    .maybeSingle()

  if (payoutError) throw payoutError

  if (!payout) {
    return { payout: null, items: [] }
  }

  const { data: items, error: itemsError } = await supabase
    .from('pallet_payout_items')
    .select('*')
    .eq('payout_id', payout.id)
    .order('created_at', { ascending: true })

  if (itemsError) throw itemsError

  return { payout, items: items ?? [] }
}

export async function confirmPalletFulfillment(
  palletId: string
): Promise<ConfirmFulfillmentResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await supabase.functions.invoke('confirm-pallet-fulfillment', {
    body: { palletId },
  })

  if (response.error) {
    const errorData = response.data as { error?: string } | undefined
    throw new Error(errorData?.error || response.error.message || 'Failed to confirm fulfillment')
  }

  return response.data as ConfirmFulfillmentResponse
}

export async function retryPalletPayout(
  palletId: string
): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await supabase.functions.invoke('process-pallet-payout', {
    body: { palletId },
  })

  if (response.error) {
    const errorData = response.data as { error?: string } | undefined
    throw new Error(errorData?.error || response.error.message || 'Failed to process payout')
  }

  return response.data as Record<string, unknown>
}
