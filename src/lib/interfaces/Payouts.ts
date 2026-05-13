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