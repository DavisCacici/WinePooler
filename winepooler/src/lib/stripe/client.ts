import { loadStripe } from '@stripe/stripe-js'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

if (!publishableKey) {
  console.warn(
    'Missing VITE_STRIPE_PUBLISHABLE_KEY — Stripe payment features will not work. ' +
    'Add it to your .env file: VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...'
  )
}

export const stripePromise = publishableKey ? loadStripe(publishableKey) : null
