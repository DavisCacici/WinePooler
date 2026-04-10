import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AddOrderModal, { computeAmountCents, formatCentsToEur } from '../AddOrderModal'

// Mock Stripe Elements
const mockConfirmCardPayment = vi.fn()
const mockGetElement = vi.fn()

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CardElement: () => <div data-testid="card-element">Card Element</div>,
  useStripe: () => ({
    confirmCardPayment: mockConfirmCardPayment,
  }),
  useElements: () => ({
    getElement: mockGetElement,
  }),
}))

vi.mock('../../../lib/stripe/client', () => ({
  stripePromise: Promise.resolve(null),
}))

const mockCreateEscrowPaymentIntent = vi.fn()
const mockCommitAuthorizedOrder = vi.fn()

vi.mock('../../../lib/supabase/queries/payments', () => ({
  createEscrowPaymentIntent: (...args: any[]) => mockCreateEscrowPaymentIntent(...args),
  commitAuthorizedOrder: (...args: any[]) => mockCommitAuthorizedOrder(...args),
}))

vi.mock('../../../lib/supabase/queries/sellingUnits', () => ({
  getSellingUnitsByWinery: vi.fn().mockResolvedValue([]),
  getEnabledSellingUnitsForProduct: vi.fn().mockResolvedValue([]),
  toBottleEquivalent: (unitType: string, qty: number, _units: any[]) => {
    if (unitType === 'bottle') return qty
    if (unitType === 'case') return qty * 6
    if (unitType === 'pallet') return qty * 60 * 6
    throw new Error('unknown unit')
  },
}))

const openPallet = {
  id: 'pal-1',
  area_id: 'area-1',
  winery_id: 'winery-1',
  state: 'open' as const,
  bottle_count: 100,
  threshold: 600,
  created_by: 'user-1',
  area_name: 'North Milan',
  winery_name: 'Cantina Aurora',
  bulk_price_per_bottle: 8.5,
  retail_price_per_bottle: 12.0,
  inventory_id: null,
  available_stock: null,
  total_stock: null,
  allocated_bottles: null,
  display_unit: null,
  display_unit_label: null,
  bottles_per_display_unit: null,
}

const defaultProps = {
  pallet: openPallet,
  buyerUserId: 'buyer-1',
  onClose: vi.fn(),
  onOrderAdded: vi.fn(),
}

describe('computeAmountCents', () => {
  it('computes amount from quantity and price per bottle', () => {
    expect(computeAmountCents(6, 8.5)).toBe(5100)
  })

  it('rounds to nearest cent', () => {
    expect(computeAmountCents(3, 7.333)).toBe(2200)
  })

  it('handles single bottle', () => {
    expect(computeAmountCents(1, 12.0)).toBe(1200)
  })
})

describe('formatCentsToEur', () => {
  it('formats cents to EUR currency string', () => {
    const result = formatCentsToEur(5100)
    expect(result).toContain('51')
  })
})

describe('AddOrderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetElement.mockReturnValue({})
  })

  it('renders pallet context: winery name, bottle count, threshold', () => {
    render(<AddOrderModal {...defaultProps} />)
    expect(screen.getByText('Cantina Aurora')).toBeInTheDocument()
    expect(screen.getByText(/100 \/ 600 bottles/i)).toBeInTheDocument()
  })

  it('shows step indicator starting at order details', () => {
    render(<AddOrderModal {...defaultProps} />)
    expect(screen.getByText('1. Order details')).toBeInTheDocument()
    expect(screen.getByText('2. Payment')).toBeInTheDocument()
  })

  it('blocks step 1 when quantity is empty', async () => {
    render(<AddOrderModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/required/i)
    expect(mockCreateEscrowPaymentIntent).not.toHaveBeenCalled()
  })

  it('blocks step 1 when quantity is 0', async () => {
    render(<AddOrderModal {...defaultProps} />)
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/positive whole number/i)
  })

  it('shows amount preview when quantity is valid', () => {
    render(<AddOrderModal {...defaultProps} />)
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '6' } })
    // 6 * 8.5 * 100 = 5100 cents = â‚¬51.00
    expect(screen.getByText(/authorization amount/i)).toBeInTheDocument()
  })

  it('proceeds to payment step after creating PaymentIntent', async () => {
    mockCreateEscrowPaymentIntent.mockResolvedValue({
      clientSecret: 'pi_xxx_secret_yyy',
      paymentIntentId: 'pi_xxx',
      amountCents: 5100,
    })

    render(<AddOrderModal {...defaultProps} />)
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    await waitFor(() => {
      expect(mockCreateEscrowPaymentIntent).toHaveBeenCalledWith('pal-1', 6)
    })

    // Step 2 should now be visible
    expect(await screen.findByText(/hold amount/i)).toBeInTheDocument()
    expect(screen.getByTestId('card-element')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /authorize & submit/i })).toBeInTheDocument()
  })

  it('shows error and stays on step 1 when PaymentIntent creation fails', async () => {
    mockCreateEscrowPaymentIntent.mockRejectedValue(new Error('Pallet has no valid pricing'))

    render(<AddOrderModal {...defaultProps} />)
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no valid pricing/i)
  })

  it('completes full payment flow: authorize, commit, onOrderAdded', async () => {
    mockCreateEscrowPaymentIntent.mockResolvedValue({
      clientSecret: 'pi_xxx_secret_yyy',
      paymentIntentId: 'pi_xxx',
      amountCents: 5100,
    })

    mockConfirmCardPayment.mockResolvedValue({
      paymentIntent: { id: 'pi_xxx', status: 'requires_capture' },
      error: null,
    })

    mockCommitAuthorizedOrder.mockResolvedValue({
      orderId: 'order-1',
      authorizationId: 'auth-1',
      newCount: 106,
      newState: 'open',
    })

    render(<AddOrderModal {...defaultProps} />)

    // Step 1
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    // Step 2
    await waitFor(() => {
      expect(screen.getByTestId('card-element')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /authorize & submit/i }))

    await waitFor(() => {
      expect(mockConfirmCardPayment).toHaveBeenCalledWith('pi_xxx_secret_yyy', {
        payment_method: { card: {} },
      })
      expect(mockCommitAuthorizedOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          palletId: 'pal-1',
          quantity: 6,
          paymentIntentId: 'pi_xxx',
          unitType: 'bottle',
        })
      )
      expect(defaultProps.onOrderAdded).toHaveBeenCalledWith(106, 'open')
    })
  })

  it('shows payment error when Stripe card decline occurs', async () => {
    mockCreateEscrowPaymentIntent.mockResolvedValue({
      clientSecret: 'pi_xxx_secret_yyy',
      paymentIntentId: 'pi_xxx',
      amountCents: 5100,
    })

    mockConfirmCardPayment.mockResolvedValue({
      paymentIntent: null,
      error: { message: 'Your card was declined.' },
    })

    render(<AddOrderModal {...defaultProps} />)

    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    await waitFor(() => {
      expect(screen.getByTestId('card-element')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /authorize & submit/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/declined/i)
    expect(defaultProps.onOrderAdded).not.toHaveBeenCalled()
  })

  it('shows conflict error when pallet is no longer available', async () => {
    mockCreateEscrowPaymentIntent.mockResolvedValue({
      clientSecret: 'pi_xxx_secret_yyy',
      paymentIntentId: 'pi_xxx',
      amountCents: 5100,
    })

    mockConfirmCardPayment.mockResolvedValue({
      paymentIntent: { id: 'pi_xxx', status: 'requires_capture' },
      error: null,
    })

    mockCommitAuthorizedOrder.mockRejectedValue(
      new Error('Pallet is no longer available â€” your authorization has been released.')
    )

    render(<AddOrderModal {...defaultProps} />)

    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    await waitFor(() => {
      expect(screen.getByTestId('card-element')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /authorize & submit/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer available/i)
    expect(defaultProps.onOrderAdded).not.toHaveBeenCalled()
  })

  it('calls onClose when Cancel button is clicked', () => {
    render(<AddOrderModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('Back button returns to step 1 from step 2', async () => {
    mockCreateEscrowPaymentIntent.mockResolvedValue({
      clientSecret: 'pi_xxx_secret_yyy',
      paymentIntentId: 'pi_xxx',
      amountCents: 5100,
    })

    render(<AddOrderModal {...defaultProps} />)

    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    await waitFor(() => {
      expect(screen.getByTestId('card-element')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    // Should be back on step 1
    expect(screen.getByRole('button', { name: /continue to payment/i })).toBeInTheDocument()
  })

  it('falls back to bottle-only when no selling units available', () => {
    render(<AddOrderModal {...defaultProps} />)
    // Unit selector should not appear (only bottle available)
    expect(screen.queryByRole('combobox', { name: /order unit/i })).not.toBeInTheDocument()
  })

  it('shows unit selector and converts case quantity to bottle equivalent', async () => {
    const caseSellingUnit = {
      id: 'su-case',
      winery_id: 'winery-1',
      unit_type: 'case' as const,
      bottles_per_case: 6,
      composition_type: null,
      pallet_quantity: null,
      discount_pct: 0,
      created_at: '',
      updated_at: '',
    }
    const { getSellingUnitsByWinery, getEnabledSellingUnitsForProduct } = await import('../../../lib/supabase/queries/sellingUnits')
    vi.mocked(getSellingUnitsByWinery).mockResolvedValueOnce([caseSellingUnit])
    vi.mocked(getEnabledSellingUnitsForProduct).mockResolvedValueOnce([caseSellingUnit])

    mockCreateEscrowPaymentIntent.mockResolvedValue({
      clientSecret: 'pi_zzz_secret_aaa',
      paymentIntentId: 'pi_zzz',
      amountCents: 4335,
    })

    const palletWithInventory = { ...openPallet, inventory_id: 'inv-1' }
    render(<AddOrderModal {...defaultProps} pallet={palletWithInventory} />)

    // Unit selector should appear with case option
    const unitSelector = await screen.findByRole('combobox', { name: /order unit/i })
    expect(unitSelector).toBeInTheDocument()

    // Select case unit
    fireEvent.change(unitSelector, { target: { value: 'case' } })

    // Enter quantity of 1 case
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    // createEscrowPaymentIntent should be called with 6 bottles (1 case Ã— 6)
    await waitFor(() => {
      expect(mockCreateEscrowPaymentIntent).toHaveBeenCalledWith('pal-1', 6)
    })
  })
})

