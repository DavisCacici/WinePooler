import { supabase } from '../client'

export interface PaymentAuthorization {
  id: string
  pallet_id: string
  buyer_id: string
  order_id: string | null
  stripe_payment_intent_id: string
  amount_cents: number
  currency: string
  status: 'authorized' | 'capture_pending' | 'captured' | 'capture_failed' | 'canceled' | 'expired'
  capture_before: string | null
  last_error: string | null
  created_at: string
  authorized_at: string
  captured_at: string | null
  updated_at: string
}

export interface CreateEscrowPaymentIntentResponse {
  clientSecret: string
  paymentIntentId: string
  amountCents: number
  captureBefore?: string
}

export interface CommitAuthorizedOrderResponse {
  orderId: string
  authorizationId: string
  newCount: number
  newState: string
}

/**
 * Calls the create-escrow-payment-intent Edge Function to create
 * a manual-capture PaymentIntent for the given pallet and quantity.
 */
export async function createEscrowPaymentIntent(
  palletId: string,
  quantity: number
): Promise<CreateEscrowPaymentIntentResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await supabase.functions.invoke('create-escrow-payment-intent', {
    body: { palletId, quantity },
  })

  if (response.error) {
    throw new Error(response.error.message || 'Failed to create payment intent')
  }

  return response.data as CreateEscrowPaymentIntentResponse
}

/**
 * Calls the commit-authorized-order Edge Function to persist
 * the order + authorization after card confirmation succeeds.
 */
export async function commitAuthorizedOrder(params: {
  palletId: string
  quantity: number
  paymentIntentId: string
  wineLabel?: string
  notes?: string
}): Promise<CommitAuthorizedOrderResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await supabase.functions.invoke('commit-authorized-order', {
    body: params,
  })

  if (response.error) {
    const errorData = response.data as { error?: string; code?: string } | undefined
    const code = errorData?.code
    if (code === 'PALLET_CONFLICT') {
      throw new Error('Pallet is no longer available — your authorization has been released.')
    }
    throw new Error(errorData?.error || response.error.message || 'Failed to commit order')
  }

  return response.data as CommitAuthorizedOrderResponse
}

/**
 * Fetches payment authorizations for the current buyer.
 */
export async function getBuyerPaymentAuthorizations(
  buyerId: string
): Promise<PaymentAuthorization[]> {
  const { data, error } = await supabase
    .from('payment_authorizations')
    .select('*')
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PaymentAuthorization[]
}

/**
 * Fetches payment authorization for a specific order.
 */
export async function getPaymentAuthorizationByOrder(
  orderId: string
): Promise<PaymentAuthorization | null> {
  const { data, error } = await supabase
    .from('payment_authorizations')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle()

  if (error) throw error
  return data as PaymentAuthorization | null
}
