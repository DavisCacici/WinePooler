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
