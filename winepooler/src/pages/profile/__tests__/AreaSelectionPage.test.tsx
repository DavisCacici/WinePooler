import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import AreaSelectionPage from '../AreaSelectionPage'
import * as macroAreaQueries from '../../../lib/supabase/queries/macroAreas'
import * as buyerProfileQueries from '../../../lib/supabase/queries/buyerProfile'

const mockNavigate = vi.fn()

vi.mock('../../../lib/supabase/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('../../../lib/supabase/queries/macroAreas', () => ({
  getMacroAreas: vi.fn(),
}))

vi.mock('../../../lib/supabase/queries/buyerProfile', () => ({
  updateBuyerArea: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const renderPage = () =>
  render(
    <BrowserRouter>
      <AreaSelectionPage />
    </BrowserRouter>
  )

describe('AreaSelectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton while areas are loading', () => {
    vi.mocked(macroAreaQueries.getMacroAreas).mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByLabelText('area-loading-skeleton')).toBeInTheDocument()
  })

  it('shows error and retry when area loading fails', async () => {
    vi.mocked(macroAreaQueries.getMacroAreas).mockRejectedValue(new Error('Network down'))

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load areas. Please try again.')
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('loads and renders area cards', async () => {
    vi.mocked(macroAreaQueries.getMacroAreas).mockResolvedValue([
      { id: '1', name: 'North Milan', slug: 'north-milan', description: 'North area', display_order: 1, metadata: null },
      { id: '2', name: 'Lake Garda', slug: 'lake-garda', description: 'Lake area', display_order: 2, metadata: null },
    ])

    renderPage()

    expect(await screen.findByText('North Milan')).toBeInTheDocument()
    expect(screen.getByText('Lake Garda')).toBeInTheDocument()
  })

  it('updates buyer area and redirects to dashboard on selection', async () => {
    vi.mocked(macroAreaQueries.getMacroAreas).mockResolvedValue([
      { id: '1', name: 'North Milan', slug: 'north-milan', description: 'North area', display_order: 1, metadata: null },
    ])
    vi.mocked(buyerProfileQueries.updateBuyerArea).mockResolvedValue()

    renderPage()

    const cardButton = await screen.findByRole('button', { name: /north milan/i })
    fireEvent.click(cardButton)

    await waitFor(() => {
      expect(buyerProfileQueries.updateBuyerArea).toHaveBeenCalledWith('user-1', '1')
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/buyer')
    })
  })
})
