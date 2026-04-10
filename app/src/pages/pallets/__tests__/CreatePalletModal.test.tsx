import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import CreatePalletModal from '../CreatePalletModal'
import * as wineryQueries from '../../../lib/supabase/queries/wineryProfiles'
import * as palletQueries from '../../../lib/supabase/queries/virtualPallets'

vi.mock('../../../lib/supabase/queries/wineryProfiles', () => ({
  getWineryProfiles: vi.fn(),
}))

vi.mock('../../../lib/supabase/queries/virtualPallets', () => ({
  getOpenPalletForWinery: vi.fn(),
  createVirtualPallet: vi.fn(),
}))

const renderModal = () =>
  render(
    <BrowserRouter>
      <CreatePalletModal
        areaId="area-1"
        areaName="North Milan"
        buyerUserId="buyer-1"
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    </BrowserRouter>
  )

describe('CreatePalletModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state while wineries are loading', () => {
    vi.mocked(wineryQueries.getWineryProfiles).mockReturnValue(new Promise(() => {}))

    renderModal()

    expect(screen.getByText(/loading wineries/i)).toBeInTheDocument()
  })

  it('shows retry when winery loading fails', async () => {
    vi.mocked(wineryQueries.getWineryProfiles).mockRejectedValue(new Error('network'))

    renderModal()

    expect(await screen.findByText(/failed to load wineries/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('blocks creation when duplicate open pallet exists', async () => {
    vi.mocked(wineryQueries.getWineryProfiles).mockResolvedValue([
      { id: 'winery-1', user_id: 'u1', company_name: 'Cantina Aurora' },
    ])
    vi.mocked(palletQueries.getOpenPalletForWinery).mockResolvedValue({
      id: 'pal-1',
      area_id: 'area-1',
      winery_id: 'winery-1',
      state: 'open',
      bottle_count: 0,
      threshold: 600,
      created_by: 'buyer-1',
      bulk_price_per_bottle: null,
      retail_price_per_bottle: null,
      inventory_id: null,
      available_stock: null,
      total_stock: null,
      allocated_bottles: null,
    })

    renderModal()

    await waitFor(() => {
      expect(screen.getByText('Cantina Aurora')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /create pallet/i }))

    await waitFor(() => {
      expect(screen.getByText(/open pallet already exists/i)).toBeInTheDocument()
      expect(palletQueries.createVirtualPallet).not.toHaveBeenCalled()
    })
  })
})
