import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SellingUnitConfig from '../SellingUnitConfig'
import * as sellingUnitsQueries from '../../../lib/supabase/queries/sellingUnits'

vi.mock('../../../lib/supabase/queries/sellingUnits', () => ({
  getSellingUnitsByWinery: vi.fn(),
  upsertSellingUnit: vi.fn(),
  deleteSellingUnit: vi.fn(),
}))

describe('SellingUnitConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state then empty form when no selling units exist', async () => {
    vi.mocked(sellingUnitsQueries.getSellingUnitsByWinery).mockResolvedValue([])

    render(<SellingUnitConfig wineryProfileId="winery-1" />)

    expect(screen.getByText('Loading selling units...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/Selling Units/)).toBeInTheDocument()
    })

    const caseToggle = screen.getByLabelText('Case Unit') as HTMLInputElement
    const palletToggle = screen.getByLabelText('Pallet Unit') as HTMLInputElement
    expect(caseToggle.checked).toBe(false)
    expect(palletToggle.checked).toBe(false)
  })

  it('pre-populates form from existing data', async () => {
    vi.mocked(sellingUnitsQueries.getSellingUnitsByWinery).mockResolvedValue([
      {
        id: 'su-1',
        winery_id: 'winery-1',
        unit_type: 'case',
        bottles_per_case: 12,
        composition_type: null,
        pallet_quantity: null,
        discount_pct: 0,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'su-2',
        winery_id: 'winery-1',
        unit_type: 'pallet',
        bottles_per_case: null,
        composition_type: 'cases',
        pallet_quantity: 40,
        discount_pct: 0,
        created_at: '',
        updated_at: '',
      },
    ])

    render(<SellingUnitConfig wineryProfileId="winery-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Selling Units/)).toBeInTheDocument()
    })

    const caseToggle = screen.getByLabelText('Case Unit') as HTMLInputElement
    const palletToggle = screen.getByLabelText('Pallet Unit') as HTMLInputElement
    expect(caseToggle.checked).toBe(true)
    expect(palletToggle.checked).toBe(true)

    const bottlesInput = screen.getByLabelText('Bottles per Case') as HTMLInputElement
    expect(bottlesInput.value).toBe('12')

    const quantityInput = screen.getByLabelText('Quantity') as HTMLInputElement
    expect(quantityInput.value).toBe('40')
  })

  it('shows validation error when pallet composition is cases but case is disabled', async () => {
    vi.mocked(sellingUnitsQueries.getSellingUnitsByWinery).mockResolvedValue([])

    render(<SellingUnitConfig wineryProfileId="winery-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Selling Units/)).toBeInTheDocument()
    })

    // Enable pallet only (case stays disabled)
    fireEvent.click(screen.getByLabelText('Pallet Unit'))

    // Change composition to cases
    fireEvent.change(screen.getByLabelText('Composition Type'), { target: { value: 'cases' } })

    expect(screen.getByText(/Cannot set pallet composition to "cases" when case unit is not enabled/)).toBeInTheDocument()

    const saveBtn = screen.getByRole('button', { name: 'Save' })
    expect(saveBtn).toBeDisabled()
  })

  it('saves successfully and shows feedback', async () => {
    vi.mocked(sellingUnitsQueries.getSellingUnitsByWinery).mockResolvedValue([])
    vi.mocked(sellingUnitsQueries.upsertSellingUnit).mockResolvedValue({
      id: 'su-new',
      winery_id: 'winery-1',
      unit_type: 'case',
      bottles_per_case: 6,
      composition_type: null,
      pallet_quantity: null,
      discount_pct: 0,
      created_at: '',
      updated_at: '',
    })

    render(<SellingUnitConfig wineryProfileId="winery-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Selling Units/)).toBeInTheDocument()
    })

    // Enable case
    fireEvent.click(screen.getByLabelText('Case Unit'))

    // Click save
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Selling units saved successfully.')).toBeInTheDocument()
    })

    expect(sellingUnitsQueries.upsertSellingUnit).toHaveBeenCalledWith({
      winery_id: 'winery-1',
      unit_type: 'case',
      bottles_per_case: 6,
      composition_type: null,
      pallet_quantity: null,
      discount_pct: 0,
    })
  })

  it('shows error feedback when save fails', async () => {
    vi.mocked(sellingUnitsQueries.getSellingUnitsByWinery).mockResolvedValue([])
    vi.mocked(sellingUnitsQueries.upsertSellingUnit).mockRejectedValue(new Error('Save failed'))

    render(<SellingUnitConfig wineryProfileId="winery-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Selling Units/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Case Unit'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument()
    })
  })

  it('shows bottle equivalent summary for pallet', async () => {
    vi.mocked(sellingUnitsQueries.getSellingUnitsByWinery).mockResolvedValue([])

    render(<SellingUnitConfig wineryProfileId="winery-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Selling Units/)).toBeInTheDocument()
    })

    // Enable both case and pallet
    fireEvent.click(screen.getByLabelText('Case Unit'))
    fireEvent.click(screen.getByLabelText('Pallet Unit'))

    // Change composition to cases
    fireEvent.change(screen.getByLabelText('Composition Type'), { target: { value: 'cases' } })

    expect(screen.getByText(/1 pallet = 60 cases × 6 bottles = 360 bottles/)).toBeInTheDocument()
  })
})
