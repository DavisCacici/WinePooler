import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import WineryDashboard from '../WineryDashboard'
import * as virtualPalletQueries from '../../../lib/supabase/queries/virtualPallets'
import * as payoutsQueries from '../../../lib/supabase/queries/payouts'

// Mock queries
vi.mock('../../../lib/supabase/queries/virtualPallets', () => ({
  getWineryPickingList: vi.fn(),
}))
vi.mock('../../../lib/supabase/queries/payouts', () => ({
  confirmPalletFulfillment: vi.fn(),
  retryPalletPayout: vi.fn(),
}))

const mockMaybeSingle = vi.fn()
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('../../../lib/supabase/client', () => ({
  supabase: {
    from: () => mockFrom(),
  },
}))

const mockUser = { id: 'user-1' }
vi.mock('../../../lib/supabase/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

const wineryProfileData = { id: 'winery-1' }

const makePicking = (overrides: Partial<virtualPalletQueries.PickingListRow> = {}): virtualPalletQueries.PickingListRow => ({
  id: 'pallet-1',
  area_name: 'Milano Nord',
  bottle_count: 120,
  allocated_bottles: 80,
  total_stock: 120,
  threshold: 0,
  state: 'frozen' as const,
  payout_status: null,
  payout_net_cents: null,
  payout_commission_cents: null,
  wine_label: null,
  ...overrides,
})

describe('WineryDashboard – payout UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMaybeSingle.mockResolvedValue({ data: wineryProfileData, error: null })
  })

  it('renders dynamic KPI cards with payout totals', async () => {
    const rows: virtualPalletQueries.PickingListRow[] = [
      makePicking({
        id: 'p1',
        state: 'completed',
        payout_status: 'paid',
        payout_net_cents: 48000,
        payout_commission_cents: 2000,
      }),
      makePicking({
        id: 'p2',
        state: 'completed',
        payout_status: 'paid',
        payout_net_cents: 25000,
        payout_commission_cents: 1500,
      }),
      makePicking({ id: 'p3', state: 'frozen' }),
      makePicking({ id: 'p4', state: 'open' }),
    ]
    vi.mocked(virtualPalletQueries.getWineryPickingList).mockResolvedValue(rows)

    render(<WineryDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Net payouts')).toBeInTheDocument()
    })

    // 48000 + 25000 = 73000 cents = €730.00
    expect(screen.getByText(/730,00/)).toBeInTheDocument()
    // 2000 + 1500 = 3500 cents = €35.00
    expect(screen.getByText(/35,00/)).toBeInTheDocument()
    // frozen count
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('shows Confirm Shipped button for frozen pallet without payout', async () => {
    vi.mocked(virtualPalletQueries.getWineryPickingList).mockResolvedValue([
      makePicking({ state: 'frozen', payout_status: null }),
    ])

    render(<WineryDashboard />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm Shipped' })).toBeInTheDocument()
    })
  })

  it('does NOT show Confirm Shipped for pallet already paid', async () => {
    vi.mocked(virtualPalletQueries.getWineryPickingList).mockResolvedValue([
      makePicking({ state: 'frozen', payout_status: 'paid', payout_net_cents: 9000 }),
    ])

    render(<WineryDashboard />)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Confirm Shipped' })).not.toBeInTheDocument()
    })
  })

  it('shows Retry Payout button for failed payout', async () => {
    vi.mocked(virtualPalletQueries.getWineryPickingList).mockResolvedValue([
      makePicking({ state: 'completed', payout_status: 'failed' }),
    ])

    render(<WineryDashboard />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry Payout' })).toBeInTheDocument()
    })
  })

  it('calls confirmPalletFulfillment and refreshes list on Confirm Shipped click', async () => {
    vi.mocked(virtualPalletQueries.getWineryPickingList).mockResolvedValue([
      makePicking({ id: 'pal-frozen', state: 'frozen', payout_status: null }),
    ])
    vi.mocked(payoutsQueries.confirmPalletFulfillment).mockResolvedValue({
      fulfillmentStatus: 'completed',
      payoutStatus: 'paid',
      payoutDetails: {},
    })

    render(<WineryDashboard />)

    const btn = await screen.findByRole('button', { name: 'Confirm Shipped' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(payoutsQueries.confirmPalletFulfillment).toHaveBeenCalledWith('pal-frozen')
    })
    // After success the picking list should be refreshed
    expect(virtualPalletQueries.getWineryPickingList).toHaveBeenCalledTimes(2)
  })

  it('shows action error when confirmPalletFulfillment fails', async () => {
    vi.mocked(virtualPalletQueries.getWineryPickingList).mockResolvedValue([
      makePicking({ id: 'pal-fail', state: 'frozen', payout_status: null }),
    ])
    vi.mocked(payoutsQueries.confirmPalletFulfillment).mockRejectedValue(new Error('Transfer failed'))

    render(<WineryDashboard />)

    const btn = await screen.findByRole('button', { name: 'Confirm Shipped' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Transfer failed')
    })
  })

  it('shows payout status badges correctly', async () => {
    vi.mocked(virtualPalletQueries.getWineryPickingList).mockResolvedValue([
      makePicking({ id: 'p-paid', state: 'completed', payout_status: 'paid', payout_net_cents: 5000 }),
      makePicking({ id: 'p-proc', state: 'completed', payout_status: 'processing' }),
      makePicking({ id: 'p-fail', state: 'completed', payout_status: 'failed' }),
    ])

    render(<WineryDashboard />)

    await waitFor(() => {
      // €50.00 displayed
      expect(screen.getByText(/50,00/)).toBeInTheDocument()
      expect(screen.getByText('Processing')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })
  })
})
