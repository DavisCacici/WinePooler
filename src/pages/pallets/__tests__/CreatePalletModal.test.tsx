import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import CreatePalletModal from '../CreatePalletModal'
import * as wineryQueries from '../../../lib/supabase/queries/wineryProfiles'
import * as palletQueries from '../../../lib/supabase/queries/virtualPallets'
import * as sellingUnitQueries from '../../../lib/supabase/queries/sellingUnits'
import * as inventoryQueries from '../../../lib/supabase/queries/wineInventory'

vi.mock('../../../lib/supabase/queries/wineryProfiles', () => ({
  getWineryProfiles: vi.fn(),
}))

vi.mock('../../../lib/supabase/queries/virtualPallets', () => ({
  getOpenPalletForWinery: vi.fn(),
  createVirtualPallet: vi.fn(),
  addOrderToPallet: vi.fn(),
}))

vi.mock('../../../lib/supabase/queries/sellingUnits', () => ({
  computePalletThreshold: vi.fn(),
}))

vi.mock('../../../lib/supabase/queries/wineInventory', () => ({
  getWineryInventory: vi.fn(),
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
    vi.mocked(inventoryQueries.getWineryInventory).mockResolvedValue([
      {
        id: 'inv-1',
        winery_id: 'winery-1',
        wine_label: 'Rosso Classico',
        sku: 'ROS-01',
        description: null,
        image_url: null,
        allocated_bottles: 240,
        price: 8.5,
        allocated_case: 40,
        available: true,
        updated_at: null,
      },
    ])
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
      { id: 'winery-1', user_id: 'u1', company_name: 'Cantina Aurora', vat_number: 'IT123' },
    ])

    renderModal()

    expect(await screen.findByTestId('threshold-info')).toHaveTextContent(/600 bottles/i)
  })

  it('shows selected product computed readonly fields', async () => {
    vi.mocked(wineryQueries.getWineryProfiles).mockResolvedValue([
      { id: 'winery-1', user_id: 'u1', company_name: 'Cantina Aurora', vat_number: 'IT123' },
    ])

    renderModal()

    await waitFor(() => {
      expect(screen.getByDisplayValue('40')).toBeInTheDocument()
      expect(screen.getByDisplayValue('240')).toBeInTheDocument()
      expect(screen.getByDisplayValue('8.50')).toBeInTheDocument()
      expect(screen.getAllByDisplayValue('0.00').length).toBeGreaterThan(0)
    })
  })

  it('shows unit-aware threshold info when pallet is configured in cases', async () => {
    vi.mocked(wineryQueries.getWineryProfiles).mockResolvedValue([
      { id: 'winery-1', user_id: 'u1', company_name: 'Cantina Aurora', vat_number: 'IT123' },
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

  it('creates pallet and adds order on submit', async () => {
    vi.mocked(wineryQueries.getWineryProfiles).mockResolvedValue([
      { id: 'winery-1', user_id: 'u1', company_name: 'Cantina Aurora', vat_number: 'IT123' },
    ])
    vi.mocked(palletQueries.getOpenPalletForWinery).mockResolvedValue(null as any)
    vi.mocked(palletQueries.createVirtualPallet).mockResolvedValue({
      id: 'pal-new', area_id: 'area-1', winery_id: 'winery-1', state: 'open',
      bottle_count: 0, threshold: 360, created_by: 'buyer-1',
      bulk_price_per_bottle: null, retail_price_per_bottle: null,
      inventory_id: 'inv-1', available_stock: null,
      allocated_bottles: null, display_unit: 'case', display_unit_label: 'cases of 6',
      bottles_per_display_unit: 6,
    })
    vi.mocked(palletQueries.addOrderToPallet).mockResolvedValue({
      newCount: 120,
      newState: 'open',
    })
    vi.mocked(sellingUnitQueries.computePalletThreshold).mockResolvedValue({
      threshold: 360,
      displayUnit: 'case',
      displayUnitLabel: 'cases of 6',
      bottlesPerDisplayUnit: 6,
    })

    renderModal()
    await waitFor(() => expect(screen.getByText('Cantina Aurora')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText(/numero di bottiglie da acquistare/i), {
      target: { value: '120' },
    })

    fireEvent.click(screen.getByRole('button', { name: /crea ordine/i }))

    await waitFor(() => {
      expect(palletQueries.createVirtualPallet).toHaveBeenCalledWith(
        expect.objectContaining({
          inventory_id: 'inv-1',
          bulk_price_per_bottle: 8.5,
          threshold: 360,
          display_unit: 'case',
          display_unit_label: 'cases of 6',
          bottles_per_display_unit: 6,
        })
      )
    })

    expect(palletQueries.addOrderToPallet).toHaveBeenCalledWith(
      'pal-new',
      'buyer-1',
      120,
      'Rosso Classico',
      expect.stringMatching(/Product SKU: ROS-01/)
    )
  })

  it('blocks creation when duplicate open pallet exists', async () => {
    vi.mocked(wineryQueries.getWineryProfiles).mockResolvedValue([
      { id: 'winery-1', user_id: 'u1', company_name: 'Cantina Aurora', vat_number: 'IT123' },
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
      allocated_bottles: null,
      display_unit: null,
      display_unit_label: null,
      bottles_per_display_unit: null,
    })

    renderModal()

    await waitFor(() => {
      expect(screen.getByText('Cantina Aurora')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/numero di bottiglie da acquistare/i), {
      target: { value: '24' },
    })

    fireEvent.click(screen.getByRole('button', { name: /crea ordine/i }))

    await waitFor(() => {
      expect(screen.getByText(/open pallet already exists/i)).toBeInTheDocument()
      expect(palletQueries.createVirtualPallet).not.toHaveBeenCalled()
    })
  })
})
