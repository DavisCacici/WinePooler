import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StripeElementsProvider from '../StripeElementsProvider'

// Mock stripe client to test both configured and unconfigured states
describe('StripeElementsProvider', () => {
  it('shows error when Stripe is not configured', async () => {
    // Mock client with null stripePromise
    vi.doMock('../../../lib/stripe/client', () => ({
      stripePromise: null,
    }))

    // Re-import after mock
    const { default: Provider } = await import('../StripeElementsProvider')

    render(
      <Provider>
        <div>child</div>
      </Provider>
    )

    expect(screen.getByText(/Stripe is not configured/)).toBeInTheDocument()
  })
})
