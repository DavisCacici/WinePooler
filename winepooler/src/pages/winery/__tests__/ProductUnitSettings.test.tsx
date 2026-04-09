import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ProductUnitSettings from '../ProductUnitSettings'
import * as wineInventoryQueries from '../../../lib/supabase/queries/wineInventory'
import * as sellingUnitsQueries from '../../../lib/supabase/queries/sellingUnits'

vi.mock('../../../lib/supabase/queries/wineInventory', () => ({
  getWineryInventory: vi.fn(),
}))

vi.mock('../../../lib/supabase/queries/sellingUnits', () => ({
  getSellingUnitsByWinery: vi.fn(),
  getProductSellingUnits: vi.fn(),
  toggleProductSellingUnit: vi.fn(),
}))

const makeSellingUnit = (overrides: Partial<sellingUnitsQueries.SellingUnit> = {}): sellingUnitsQueries.SellingUnit => ({
  id: 'su-1',
  winery_id: 'winery-1',
  unit_type: 'bottle',
  bottles_per_case: null,
  composition_type: null,
  pallet_quantity: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const makeInventory = (overrides: Partial<wineInventoryQueries.WineInventory> = {}): wineInventoryQueries.WineInventory => ({
  id: 'inv-1',
  winery_id: 'winery-1',
  wine_label: 'Rosso Riserva',
  sku: 'CAU-RR-001',
  total_stock: 800,
  allocated_bottles: 400,
  available_stock: 400,
  ...overrides,
})

describe('ProductUnitSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty message when no selling units are defined', async () => {
    vi.mocked(wineInventoryQueries.getWineryInventory).mockResolvedValue([makeInventory()])
    vi.mocked(sellingUnitsQueries.getSellingUnitsByWinery).mockResolvedValue([])

    render(<ProductUnitSettings wineryProfileId="winery-1" />)

    await waitFor(() => {
      expect(screen.getByText('Define your selling units above before configuring products.')).toBeInTheDocument()
    })
  })

  it('shows empty message when no inventory exists', async () => {
    vi.mocked(wineInventoryQueries.getWineryInventory).mockResolvedValue([])
    vi.mocked(sellingUnitsQueries.getSellingUnitsByWinery).mockResolvedValue([
      makeSellingUnit({ id: 'su-bottle', unit_type: 'bottle' }),
    ])

    render(<ProductUnitSettings wineryProfileId="winery-1" />)

    await waitFor(() => {
      expect(screen.getByText('No products to configure. Add wine inventory first.')).toBeInTheDocument()
    })
  })

  it('renders table with correct products and toggle states', async () => {
    const units = [
      makeSellingUnit({ id: 'su-bottle', unit_type: 'bottle' }),
      makeSellingUnit({ id: 'su-case', unit_type: 'case', bottles_per_case: 6 }),
    ]
    const inventory = [
      makeInventory({ id: 'inv-1', wine_label: 'Rosso Riserva', sku: 'CAU-RR-001' }),
      makeInventory({ id: 'inv-2', wine_label: 'Bianco Superiore', sku: 'TCO-BS-001' }),
    ]

    vi.mocked(wineInventoryQueries.getWineryInventory).mockResolvedValue(inventory)
    vi.mocked(sellingUnitsQueries.getSellingUnitsByWinery).mockResolvedValue(units)
    vi.mocked(sellingUnitsQueries.getProductSellingUnits).mockImplementation(async (invId: string) => {
      if (invId === 'inv-1') {
        return [
          { id: 'psu-1', inventory_id: 'inv-1', selling_unit_id: 'su-bottle', enabled: true, created_at: '' },
          { id: 'psu-2', inventory_id: 'inv-1', selling_unit_id: 'su-case', enabled: false, created_at: '' },
        ]
      }
      return [
        { id: 'psu-3', inventory_id: 'inv-2', selling_unit_id: 'su-bottle', enabled: true, created_at: '' },
        { id: 'psu-4', inventory_id: 'inv-2', selling_unit_id: 'su-case', enabled: true, created_at: '' },
      ]
    })

    render(<ProductUnitSettings wineryProfileId="winery-1" />)

    await waitFor(() => {
      expect(screen.getByText('Rosso Riserva')).toBeInTheDocument()
      expect(screen.getByText('Bianco Superiore')).toBeInTheDocument()
    })

    // Check toggle states via aria-labels
    const bottleToggle1 = screen.getByLabelText('bottle for Rosso Riserva') as HTMLInputElement
    const caseToggle1 = screen.getByLabelText('case for Rosso Riserva') as HTMLInputElement
    expect(bottleToggle1.checked).toBe(true)
    expect(caseToggle1.checked).toBe(false)

    const bottleToggle2 = screen.getByLabelText('bottle for Bianco Superiore') as HTMLInputElement
    const caseToggle2 = screen.getByLabelText('case for Bianco Superiore') as HTMLInputElement
    expect(bottleToggle2.checked).toBe(true)
    expect(caseToggle2.checked).toBe(true)
  })

  it('calls toggleProductSellingUnit with correct params on toggle', async () => {
    const units = [
      makeSellingUnit({ id: 'su-bottle', unit_type: 'bottle' }),
      makeSellingUnit({ id: 'su-case', unit_type: 'case', bottles_per_case: 6 }),
    ]
    const inventory = [makeInventory({ id: 'inv-1' })]

    vi.mocked(wineInventoryQueries.getWineryInventory).mockResolvedValue(inventory)
    vi.mocked(sellingUnitsQueries.getSellingUnitsByWinery).mockResolvedValue(units)
    vi.mocked(sellingUnitsQueries.getProductSellingUnits).mockResolvedValue([
      { id: 'psu-1', inventory_id: 'inv-1', selling_unit_id: 'su-bottle', enabled: true, created_at: '' },
      { id: 'psu-2', inventory_id: 'inv-1', selling_unit_id: 'su-case', enabled: true, created_at: '' },
    ])
    vi.mocked(sellingUnitsQueries.toggleProductSellingUnit).mockResolvedValue()

    render(<ProductUnitSettings wineryProfileId="winery-1" />)

    await waitFor(() => {
      expect(screen.getByText('Rosso Riserva')).toBeInTheDocument()
    })

    const caseToggle = screen.getByLabelText('case for Rosso Riserva')
    fireEvent.click(caseToggle)

    await waitFor(() => {
      expect(sellingUnitsQueries.toggleProductSellingUnit).toHaveBeenCalledWith('inv-1', 'su-case', false)
    })
  })

  it('prevents disabling the last enabled unit', async () => {
    const units = [
      makeSellingUnit({ id: 'su-bottle', unit_type: 'bottle' }),
      makeSellingUnit({ id: 'su-case', unit_type: 'case', bottles_per_case: 6 }),
    ]
    const inventory = [makeInventory({ id: 'inv-1' })]

    vi.mocked(wineInventoryQueries.getWineryInventory).mockResolvedValue(inventory)
    vi.mocked(sellingUnitsQueries.getSellingUnitsByWinery).mockResolvedValue(units)
    vi.mocked(sellingUnitsQueries.getProductSellingUnits).mockResolvedValue([
      { id: 'psu-1', inventory_id: 'inv-1', selling_unit_id: 'su-bottle', enabled: true, created_at: '' },
      { id: 'psu-2', inventory_id: 'inv-1', selling_unit_id: 'su-case', enabled: false, created_at: '' },
    ])

    render(<ProductUnitSettings wineryProfileId="winery-1" />)

    await waitFor(() => {
      expect(screen.getByText('Rosso Riserva')).toBeInTheDocument()
    })

    // Only bottle is enabled — its toggle should be disabled
    const bottleToggle = screen.getByLabelText('bottle for Rosso Riserva') as HTMLInputElement
    expect(bottleToggle.disabled).toBe(true)

    // The label should have the tooltip
    const toggleLabel = bottleToggle.closest('label')
    expect(toggleLabel?.title).toBe('At least one unit type must be enabled')
  })
})
