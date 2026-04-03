import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import BuyerDashboard from '../BuyerDashboard'
import * as buyerProfileQueries from '../../../lib/supabase/queries/buyerProfile'
import * as buyerPreferencesQueries from '../../../lib/supabase/queries/buyerPreferences'
import * as virtualPalletQueries from '../../../lib/supabase/queries/virtualPallets'
import { isPalletPreferred } from '../BuyerDashboard'

// Mock queries
vi.mock('../../../lib/supabase/queries/buyerProfile', () => ({
  getBuyerProfile: vi.fn(),
}))
vi.mock('../../../lib/supabase/queries/buyerPreferences', () => ({
  getBuyerPreferences: vi.fn(),
}))
vi.mock('../../../lib/supabase/queries/virtualPallets', () => ({
  getPalletsByArea: vi.fn(),
  buyerHasOrderOnPallet: vi.fn(),
}))

// Mock Supabase client (needed for Realtime channel subscription)
const mockSubscribe = vi.fn()
const mockOn = vi.fn()
const mockChannel = vi.fn()
const mockRemoveChannel = vi.fn()

vi.mock('../../../lib/supabase/client', () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}))

beforeEach(() => {
  mockSubscribe.mockReturnValue({})
  mockOn.mockReturnValue({ subscribe: mockSubscribe })
  mockChannel.mockReturnValue({ on: mockOn })
})

const mockUser = { id: 'user-1' }
vi.mock('../../../lib/supabase/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('BuyerDashboard - profile completion guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-set Realtime channel mock chain after clearAllMocks
    mockSubscribe.mockReturnValue({})
    mockOn.mockReturnValue({ subscribe: mockSubscribe })
    mockChannel.mockReturnValue({ on: mockOn })
    vi.mocked(buyerPreferencesQueries.getBuyerPreferences).mockResolvedValue(null)
    vi.mocked(virtualPalletQueries.getPalletsByArea).mockResolvedValue([])
    vi.mocked(virtualPalletQueries.buyerHasOrderOnPallet).mockResolvedValue(false)
  })

  it('redirects to /profile/complete when no profile exists', async () => {
    vi.mocked(buyerProfileQueries.getBuyerProfile).mockResolvedValue(null)

    render(
      <BrowserRouter>
        <BuyerDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile/complete')
    })
  })

  it('redirects to /profile/area when profile has no macro_area_id', async () => {
    vi.mocked(buyerProfileQueries.getBuyerProfile).mockResolvedValue({
      id: 'profile-1',
      user_id: 'user-1',
      company_name: 'Acme SRL',
      vat_number: 'IT12345678901',
      address_street: 'Via Roma 1',
      address_city: 'Milan',
      address_country: 'IT',
      macro_area_id: null,
    })

    render(
      <BrowserRouter>
        <BuyerDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile/area')
    })
  })

  it('renders filtered pallets and active area when profile has macro area', async () => {
    vi.mocked(buyerProfileQueries.getBuyerProfile).mockResolvedValue({
      id: 'profile-1',
      user_id: 'user-1',
      company_name: 'Acme SRL',
      vat_number: 'IT12345678901',
      address_street: 'Via Roma 1',
      address_city: 'Milan',
      address_country: 'IT',
      macro_area_id: 'area-1',
      macro_area_name: 'North Milan',
    })
    vi.mocked(buyerPreferencesQueries.getBuyerPreferences).mockResolvedValue({
      user_id: 'user-1',
      preferred_wine_types: ['Red'],
      preferred_appellations: ['Aurora'],
      monthly_budget_min: null,
      monthly_budget_max: null,
    })
    vi.mocked(virtualPalletQueries.getPalletsByArea).mockResolvedValue([
      {
        id: 'pal-1',
        area_id: 'area-1',
        winery_id: 'winery-1',
        state: 'open',
        bottle_count: 0,
        threshold: 600,
        created_by: 'user-1',
        area_name: 'North Milan',
        winery_name: 'Cantina Aurora',
      },
      {
        id: 'pal-2',
        area_id: 'area-1',
        winery_id: 'winery-2',
        state: 'open',
        bottle_count: 120,
        threshold: 600,
        created_by: 'user-2',
        area_name: 'North Milan',
        winery_name: 'Tenuta Collina',
      },
    ])

    render(
      <BrowserRouter>
        <BuyerDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/pallet discovery/i)).toBeInTheDocument()
      expect(screen.getByText(/buyer dashboard · north milan/i)).toBeInTheDocument()
      expect(screen.getByText(/preferences set/i)).toBeInTheDocument()
    })

    expect(screen.getByText('Cantina Aurora')).toBeInTheDocument()
    expect(screen.getByText('Tenuta Collina')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalledWith('/profile/area')

    const preferredCard = screen.getByText('Cantina Aurora').closest('article')
    expect(preferredCard).toHaveClass('ring-2', 'ring-emerald-500')
  })

  it('shows set preferences prompt when preferences do not exist', async () => {
    vi.mocked(buyerProfileQueries.getBuyerProfile).mockResolvedValue({
      id: 'profile-1',
      user_id: 'user-1',
      company_name: 'Acme SRL',
      vat_number: 'IT12345678901',
      address_street: 'Via Roma 1',
      address_city: 'Milan',
      address_country: 'IT',
      macro_area_id: 'area-1',
      macro_area_name: 'North Milan',
    })
    vi.mocked(buyerPreferencesQueries.getBuyerPreferences).mockResolvedValue(null)

    render(
      <BrowserRouter>
        <BuyerDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/set preferences to highlight matching pallets/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /new pallet/i })).toBeInTheDocument()
  })
})

describe('isPalletPreferred', () => {
  it('returns true when winery or area matches appellation keyword', () => {
    const matched = isPalletPreferred(
      { area: 'North Milan', winery: 'Cantina Aurora' },
      {
        user_id: 'user-1',
        preferred_wine_types: [],
        preferred_appellations: ['aurora'],
        monthly_budget_min: null,
        monthly_budget_max: null,
      }
    )

    expect(matched).toBe(true)
  })

  it('returns false when preferences are null', () => {
    const matched = isPalletPreferred({ area: 'North Milan', winery: 'Cantina Aurora' }, null)

    expect(matched).toBe(false)
  })
})

describe('BuyerDashboard - Add Order button state', () => {
  const profileWithArea = {
    id: 'profile-1',
    user_id: 'user-1',
    company_name: 'Acme SRL',
    vat_number: 'IT12345678901',
    address_street: 'Via Roma 1',
    address_city: 'Milan',
    address_country: 'IT',
    macro_area_id: 'area-1',
    macro_area_name: 'North Milan',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscribe.mockReturnValue({})
    mockOn.mockReturnValue({ subscribe: mockSubscribe })
    mockChannel.mockReturnValue({ on: mockOn })
    vi.mocked(buyerProfileQueries.getBuyerProfile).mockResolvedValue(profileWithArea)
    vi.mocked(buyerPreferencesQueries.getBuyerPreferences).mockResolvedValue(null)
    vi.mocked(virtualPalletQueries.buyerHasOrderOnPallet).mockResolvedValue(false)
  })

  it('disables "Add Order" button when pallet state is frozen', async () => {
    vi.mocked(virtualPalletQueries.getPalletsByArea).mockResolvedValue([
      {
        id: 'pal-frozen',
        area_id: 'area-1',
        winery_id: 'winery-1',
        state: 'frozen',
        bottle_count: 600,
        threshold: 600,
        created_by: 'user-1',
        area_name: 'North Milan',
        winery_name: 'Cantina Aurora',
      },
    ])

    render(
      <BrowserRouter>
        <BuyerDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Cantina Aurora')).toBeInTheDocument()
    })

    const addOrderButton = screen.getByRole('button', { name: /add order/i })
    expect(addOrderButton).toBeDisabled()
  })

  it('disables "Add Order" button when pallet state is completed', async () => {
    vi.mocked(virtualPalletQueries.getPalletsByArea).mockResolvedValue([
      {
        id: 'pal-completed',
        area_id: 'area-1',
        winery_id: 'winery-1',
        state: 'completed',
        bottle_count: 600,
        threshold: 600,
        created_by: 'user-1',
        area_name: 'North Milan',
        winery_name: 'Cantina Aurora',
      },
    ])

    render(
      <BrowserRouter>
        <BuyerDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Cantina Aurora')).toBeInTheDocument()
    })

    const addOrderButton = screen.getByRole('button', { name: /add order/i })
    expect(addOrderButton).toBeDisabled()
  })

  it('enables "Add Order" button when pallet state is open', async () => {
    vi.mocked(virtualPalletQueries.getPalletsByArea).mockResolvedValue([
      {
        id: 'pal-open',
        area_id: 'area-1',
        winery_id: 'winery-1',
        state: 'open',
        bottle_count: 100,
        threshold: 600,
        created_by: 'user-1',
        area_name: 'North Milan',
        winery_name: 'Cantina Aurora',
      },
    ])

    render(
      <BrowserRouter>
        <BuyerDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Cantina Aurora')).toBeInTheDocument()
    })

    const addOrderButton = screen.getByRole('button', { name: /add order/i })
    expect(addOrderButton).not.toBeDisabled()
  })

  it('subscribes to Realtime channel with area filter on mount', async () => {
    vi.mocked(virtualPalletQueries.getPalletsByArea).mockResolvedValue([])

    render(
      <BrowserRouter>
        <BuyerDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalledWith('virtual_pallets:area_id=eq.area-1')
    })

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        table: 'virtual_pallets',
        filter: 'area_id=eq.area-1',
      }),
      expect.any(Function)
    )
  })

  it('shows freeze notification when Realtime UPDATE fires with frozen state and buyer has order', async () => {
    // Capture the Realtime UPDATE handler when it is registered
    let realtimeHandler: ((payload: any) => void) | null = null
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (p: any) => void) => {
      realtimeHandler = handler
      return { subscribe: mockSubscribe }
    })

    vi.mocked(virtualPalletQueries.getPalletsByArea).mockResolvedValue([
      {
        id: 'pal-open',
        area_id: 'area-1',
        winery_id: 'winery-1',
        state: 'open',
        bottle_count: 580,
        threshold: 600,
        created_by: 'user-1',
        area_name: 'North Milan',
        winery_name: 'Cantina Aurora',
      },
    ])
    vi.mocked(virtualPalletQueries.buyerHasOrderOnPallet).mockResolvedValue(true)

    render(
      <BrowserRouter>
        <BuyerDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Cantina Aurora')).toBeInTheDocument()
    })

    // Simulate Realtime UPDATE: pallet just froze
    realtimeHandler!({ new: { id: 'pal-open', bottle_count: 600, state: 'frozen' } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/pallet frozen/i)
      expect(screen.getByRole('alert')).toHaveTextContent(/cantina aurora/i)
    })
  })

  it('does not show freeze notification when buyer has no order on frozen pallet', async () => {
    let realtimeHandler: ((payload: any) => void) | null = null
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (p: any) => void) => {
      realtimeHandler = handler
      return { subscribe: mockSubscribe }
    })

    vi.mocked(virtualPalletQueries.getPalletsByArea).mockResolvedValue([
      {
        id: 'pal-open',
        area_id: 'area-1',
        winery_id: 'winery-1',
        state: 'open',
        bottle_count: 580,
        threshold: 600,
        created_by: 'user-1',
        area_name: 'North Milan',
        winery_name: 'Cantina Aurora',
      },
    ])
    vi.mocked(virtualPalletQueries.buyerHasOrderOnPallet).mockResolvedValue(false)

    render(
      <BrowserRouter>
        <BuyerDashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Cantina Aurora')).toBeInTheDocument()
    })

    realtimeHandler!({ new: { id: 'pal-open', bottle_count: 600, state: 'frozen' } })

    // Wait a tick for async check
    await new Promise(r => setTimeout(r, 50))

    expect(screen.queryByRole('alert')).toBeNull()
  })
})
