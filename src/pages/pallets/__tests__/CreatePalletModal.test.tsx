import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import CreatePalletModal from '../CreatePalletModal'
import * as wineryQueries from '../../../lib/supabase/queries/wineryProfiles'
import * as palletQueries from '../../../lib/supabase/queries/virtualPallets'
import * as sellingUnitQueries from '../../../lib/supabase/queries/sellingUnits'

vi.mock('../../../lib/supabase/queries/wineryProfiles', () => ({
  getWineryProfiles: vi.fn(),
}))

vi.mock('../../../lib/supabase/queries/virtualPallets', () => ({
  getOpenPalletForWinery: vi.fn(),
  createVirtualPallet: vi.fn(),
}))

vi.mock('../../../lib/supabase/queries/sellingUnits', () => ({
  computePalletThreshold: vi.fn(),
}))

const defaultThresholdInfo = {
  threshold: 600,
  displayUnit: 'bottle',
  displayUnitLabel: 'bottles',
  bottlesPerDisplayUnit: null,
}

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
    vi.mocked(sellingUnitQueries.computePalletThreshold).mockResolvedValue(defaultThresholdInfo)
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

  it('shows threshold info for bottle-only winery', async () => {
    vi.mocked(wineryQueries.getWineryProfiles).mockResolvedValue([
      { id: 'winery-1', user_id: 'u1', company_name: 'Cantina Aurora' },
    ])

    renderModal()

    expect(await screen.findByTestId('threshold-info')).toHaveTextContent(/600 bottles/i)
  })

  it('shows unit-aware threshold info when pallet is configured in cases', async () => {
    vi.mocked(wineryQueries.getWineryProfiles).mockResolvedValue([
      { id: 'winery-1', user_id: 'u1', company_name: 'Cantina Aurora' },
    ])
    vi.mocked(sellingUnitQueries.computePalletThreshold).mockResolvedValue({
      threshold: 360,
      displayUnit: 'case',
      displayUnitLabel: 'cases of 6',
      bottlesPerDisplayUnit: 6,
    })

    renderModal()

    expect(await screen.findByTestId('threshold-info')).toHaveTextContent(/60 cases of 6/i)
  })

  it('passes threshold info to createVirtualPallet on submit', async () => {
    vi.mocked(wineryQueries.getWineryProfiles).mockResolvedValue([
      { id: 'winery-1', user_id: 'u1', company_name: 'Cantina Aurora' },
    ])
    vi.mocked(palletQueries.getOpenPalletForWinery).mockResolvedValue(null as any)
    vi.mocked(palletQueries.createVirtualPallet).mockResolvedValue({
      id: 'pal-new', area_id: 'area-1', winery_id: 'winery-1', state: 'open',
      bottle_count: 0, threshold: 360, created_by: 'buyer-1',
      bulk_price_per_bottle: null, retail_price_per_bottle: null,
      inventory_id: null, available_stock: null, total_stock: null,
      allocated_bottles: null, display_unit: 'case', display_unit_label: 'cases of 6',
      bottles_per_display_unit: 6,
    })
    vi.mocked(sellingUnitQueries.computePalletThreshold).mockResolvedValue({
      threshold: 360,
      displayUnit: 'case',
      displayUnitLabel: 'cases of 6',
      bottlesPerDisplayUnit: 6,
    })

    renderModal()
    await waitFor(() => expect(screen.getByText('Cantina Aurora')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /create pallet/i }))

    await waitFor(() => {
      expect(palletQueries.createVirtualPallet).toHaveBeenCalledWith(
        expect.objectContaining({
          threshold: 360,
          display_unit: 'case',
          display_unit_label: 'cases of 6',
          bottles_per_display_unit: 6,
        })
      )
    })
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
      display_unit: null,
      display_unit_label: null,
      bottles_per_display_unit: null,
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
