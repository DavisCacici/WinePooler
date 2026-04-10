import { useState, useEffect } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { type VirtualPallet } from '../../lib/supabase/queries/virtualPallets'
import { palletProgressPercent } from '../../lib/palletProgress'
import { stripePromise } from '../../lib/stripe/client'
import {
  createEscrowPaymentIntent,
  commitAuthorizedOrder,
} from '../../lib/supabase/queries/payments'

export type PaymentFlowState =
  | 'order_details'
  | 'authorizing'
  | 'authorized'
  | 'committing'
  | 'capture_pending'
  | 'captured'
  | 'payment_failed'
  | 'conflict'

interface AddOrderModalProps {
  pallet: VirtualPallet
  buyerUserId: string
  onClose: () => void
  onOrderAdded: (newCount: number, newState: 'open' | 'frozen') => void
}

/** Formats cents to a EUR currency string. */
export function formatCentsToEur(cents: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

/** Pure amount computation: quantity × pricePerBottle × 100. */
export function computeAmountCents(quantity: number, pricePerBottle: number): number {
  return Math.round(quantity * pricePerBottle * 100)
}

/* ------------------------------------------------------------------ */
/*  Inner payment form — must be rendered inside <Elements>           */
/* ------------------------------------------------------------------ */

interface PaymentFormProps {
  pallet: VirtualPallet
  buyerUserId: string
  onClose: () => void
  onOrderAdded: (newCount: number, newState: 'open' | 'frozen') => void
}

const PaymentForm = ({ pallet, buyerUserId, onClose, onOrderAdded }: PaymentFormProps) => {
  const stripe = useStripe()
  const elements = useElements()
  console.log('Rendering PaymentForm with pallet:', buyerUserId);
  const [step, setStep] = useState<'order_details' | 'payment_details'>('order_details')
  const [flowState, setFlowState] = useState<PaymentFlowState>('order_details')
  const [quantity, setQuantity] = useState('')
  const [wineLabel, setWineLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [quantityError, setQuantityError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [amountCents, setAmountCents] = useState<number>(0)

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, loading])

  const validateQuantity = (value: string): string | null => {
    if (!value.trim()) return 'Quantity is required'
    const num = Number(value)
    if (!Number.isInteger(num) || num <= 0) return 'Quantity must be a positive whole number'
    return null
  }

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuantity(value)
    setQuantityError(validateQuantity(value))
  }

  /* Step 1 → Step 2: Create PaymentIntent and show card form */
  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault()

    const qError = validateQuantity(quantity)
    if (qError) {
      setQuantityError(qError)
      return
    }

    setLoading(true)
    setSubmitError(null)
    setFlowState('authorizing')

    try {
      const intent = await createEscrowPaymentIntent(pallet.id, Number(quantity))
      setClientSecret(intent.clientSecret)
      setPaymentIntentId(intent.paymentIntentId)
      setAmountCents(intent.amountCents)
      setStep('payment_details')
      setFlowState('order_details')
    } catch (err: any) {
      setSubmitError(err?.message ?? 'Failed to prepare payment. Please try again.')
      setFlowState('payment_failed')
    } finally {
      setLoading(false)
    }
  }

  /* Step 2: Confirm card → commit order */
  const handlePaymentAndCommit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !clientSecret || !paymentIntentId) return

    setLoading(true)
    setSubmitError(null)
    setFlowState('authorizing')

    try {
      // 1. Confirm the card with Stripe Elements
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Card element not found')
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: { card: cardElement },
        }
      )

      if (stripeError) {
        setFlowState('payment_failed')
        setSubmitError(stripeError.message ?? 'Payment authorization failed')
        return
      }

      if (!paymentIntent || paymentIntent.status !== 'requires_capture') {
        setFlowState('payment_failed')
        setSubmitError('Unexpected payment state. Please try again.')
        return
      }

      setFlowState('authorized')

      // 2. Commit the order via Edge Function
      setFlowState('committing')
      const result = await commitAuthorizedOrder({
        palletId: pallet.id,
        quantity: Number(quantity),
        paymentIntentId: paymentIntent.id,
        wineLabel: wineLabel.trim() || undefined,
        notes: notes.trim() || undefined,
      })

      if (result.newState === 'frozen') {
        setFlowState('capture_pending')
      } else {
        setFlowState('authorized')
      }

      onOrderAdded(result.newCount, result.newState as 'open' | 'frozen')
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to submit order.'
      if (msg.includes('no longer available')) {
        setFlowState('conflict')
        setSubmitError('This pallet is no longer available — your authorization has been released.')
      } else {
        setFlowState('payment_failed')
        setSubmitError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const progressPct = palletProgressPercent(pallet.bottle_count, pallet.threshold)
  const hasPricing = pallet.bulk_price_per_bottle != null && pallet.bulk_price_per_bottle > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-order-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-surface p-8 shadow-lg ring-1 ring-border">
        <h2 id="add-order-title" className="text-xl font-bold text-primary">
          Add Order
        </h2>
        <p className="mt-1 text-sm text-secondary">
          {step === 'order_details'
            ? 'Submit your bottle order for this pallet.'
            : 'Enter your payment details to authorize the hold.'}
        </p>

        {/* Step indicator */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span className={step === 'order_details' ? 'font-semibold text-accent-buyer' : 'text-accent-buyer opacity-70'}>
            1. Order details
          </span>
          <span>→</span>
          <span className={step === 'payment_details' ? 'font-semibold text-accent-buyer' : ''}>
            2. Payment
          </span>
        </div>

        {/* Pallet context */}
        <div className="mt-5 rounded-2xl bg-surface-alt p-4 ring-1 ring-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-buyer">
            {pallet.winery_name ?? 'Unknown winery'}
          </p>
          <p className="mt-1 text-sm text-secondary">
            {pallet.bottle_count} / {pallet.threshold} bottles
          </p>
          <div className="mt-2 h-2 rounded-full bg-surface-elevated">
            <div
              className="h-2 rounded-full bg-accent-buyer transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">{progressPct}% full</p>
          {hasPricing && (
            <p className="mt-1 text-xs text-muted">
              Price per bottle: {formatCentsToEur(pallet.bulk_price_per_bottle! * 100)}
            </p>
          )}
        </div>

        {/* Step 1: Order details form */}
        {step === 'order_details' && (
          <form onSubmit={handleProceedToPayment} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="order-quantity" className="block text-sm font-medium text-secondary">
                Quantity (bottles) <span aria-hidden="true">*</span>
              </label>
              <input
                id="order-quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={handleQuantityChange}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-primary bg-surface focus:border-accent-buyer focus:outline-none focus:ring-1 focus:ring-focus"
                placeholder="e.g. 12"
                aria-describedby={quantityError ? 'quantity-error' : undefined}
                aria-invalid={quantityError ? 'true' : 'false'}
              />
              {quantityError && (
                <p id="quantity-error" role="alert" className="mt-1 text-xs text-error">
                  {quantityError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="order-wine-label" className="block text-sm font-medium text-secondary">
                Wine label <span className="text-muted">(optional)</span>
              </label>
              <input
                id="order-wine-label"
                type="text"
                value={wineLabel}
                onChange={e => setWineLabel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-primary bg-surface focus:border-accent-buyer focus:outline-none focus:ring-1 focus:ring-focus"
                placeholder="e.g. Barolo Riserva 2019"
              />
            </div>

            <div>
              <label htmlFor="order-notes" className="block text-sm font-medium text-secondary">
                Notes <span className="text-muted">(optional)</span>
              </label>
              <textarea
                id="order-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-primary bg-surface focus:border-accent-buyer focus:outline-none focus:ring-1 focus:ring-focus"
                placeholder="Any special requirements..."
              />
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-error">
                {submitError}
              </p>
            )}

            {/* Amount preview */}
            {hasPricing && quantity && !validateQuantity(quantity) && (
              <div className="rounded-xl bg-success-bg p-3 text-sm text-success-text">
                Authorization amount:{' '}
                <span className="font-semibold">
                  {formatCentsToEur(computeAmountCents(Number(quantity), pallet.bulk_price_per_bottle!))}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-full border border-border bg-surface-alt px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-elevated disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !hasPricing}
                className="flex-1 rounded-full bg-accent-buyer px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {loading ? 'Preparing…' : 'Continue to Payment'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Payment details form */}
        {step === 'payment_details' && (
          <form onSubmit={handlePaymentAndCommit} noValidate className="mt-6 space-y-4">
            {/* Order summary */}
            <div className="rounded-xl bg-surface-alt p-3 text-sm text-secondary">
              <p>
                <span className="font-medium">{quantity} bottles</span>
                {wineLabel && <span className="text-muted"> — {wineLabel}</span>}
              </p>
              <p className="mt-1 font-semibold text-accent-buyer">
                Hold amount: {formatCentsToEur(amountCents)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Funds will be held but not charged until the pallet freezes.
              </p>
            </div>

            {/* Stripe CardElement */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Card details
              </label>
              <div className="rounded-xl border border-border px-3 py-3">
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: '14px',
                        color: '#0f172a',
                        '::placeholder': { color: '#94a3b8' },
                      },
                      invalid: { color: '#dc2626' },
                    },
                  }}
                />
              </div>
            </div>

            {/* Flow status messages */}
            {flowState === 'authorizing' && (
              <p className="text-sm text-warning">Authorizing payment…</p>
            )}
            {flowState === 'committing' && (
              <p className="text-sm text-warning">Confirming order…</p>
            )}
            {flowState === 'conflict' && (
              <p role="alert" className="text-sm text-error">
                {submitError}
              </p>
            )}
            {flowState === 'payment_failed' && submitError && (
              <p role="alert" className="text-sm text-error">
                {submitError}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('order_details')
                  setFlowState('order_details')
                  setSubmitError(null)
                  setClientSecret(null)
                  setPaymentIntentId(null)
                }}
                disabled={loading}
                className="flex-1 rounded-full border border-border bg-surface-alt px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-elevated disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !stripe || !elements}
                className="flex-1 rounded-full bg-accent-buyer px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {loading ? 'Processing…' : 'Authorize & Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Wrapper that provides Stripe Elements context                     */
/* ------------------------------------------------------------------ */

const AddOrderModal = (props: AddOrderModalProps) => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm {...props} />
    </Elements>
  )
}

export default AddOrderModal
