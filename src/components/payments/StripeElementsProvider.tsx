import type { ReactNode } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { stripePromise } from '../../lib/stripe/client'

interface StripeElementsProviderProps {
  children: ReactNode
  clientSecret?: string
}

const StripeElementsProvider = ({ children, clientSecret }: StripeElementsProviderProps) => {
  if (!stripePromise) {
    return <div className="p-4 text-sm text-error">Stripe is not configured. Check VITE_STRIPE_PUBLISHABLE_KEY.</div>
  }

  const options = clientSecret ? { clientSecret } : undefined

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  )
}

export default StripeElementsProvider
