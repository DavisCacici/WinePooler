import type { ConfirmFulfillmentResponse, PalletPayout, PayoutItem } from '../../interfaces/Payouts'
import { supabase } from '../client'



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
