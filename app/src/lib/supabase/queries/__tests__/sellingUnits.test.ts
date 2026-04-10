import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  getSellingUnitsByWinery,
  upsertSellingUnit,
  deleteSellingUnit,
  getProductSellingUnits,
  toggleProductSellingUnit,
  getEnabledSellingUnitsForProduct,
} from '../sellingUnits'

const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockUpsert = vi.fn()
const mockDelete = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getSellingUnitsByWinery', () => {
  it('returns selling units for a winery', async () => {
    const mockUnits = [
      { id: 'su-1', winery_id: 'w-1', unit_type: 'bottle', bottles_per_case: null, composition_type: null, pallet_quantity: null },
      { id: 'su-2', winery_id: 'w-1', unit_type: 'case', bottles_per_case: 6, composition_type: null, pallet_quantity: null },
    ]
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({ data: mockUnits, error: null })

    const result = await getSellingUnitsByWinery('w-1')

    expect(mockFrom).toHaveBeenCalledWith('selling_units')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('winery_id', 'w-1')
    expect(mockOrder).toHaveBeenCalledWith('unit_type')
    expect(result).toEqual(mockUnits)
  })

  it('returns empty array when no selling units exist', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({ data: null, error: null })

    const result = await getSellingUnitsByWinery('w-empty')
    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({ data: null, error: new Error('DB error') })

    await expect(getSellingUnitsByWinery('w-1')).rejects.toThrow('DB error')
  })
})

describe('upsertSellingUnit', () => {
  it('upserts and returns the selling unit', async () => {
    const input = { 
      winery_id: 'w-1', 
      unit_type: 'case' as const, 
      bottles_per_case: 6, 
      composition_type: null, 
      pallet_quantity: null,
      discount_pct: 0,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z'
    }
    const saved = { id: 'su-new', ...input }

    mockFrom.mockReturnValue({ upsert: mockUpsert })
    mockUpsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: saved, error: null })

    const result = await upsertSellingUnit(input)

    expect(mockFrom).toHaveBeenCalledWith('selling_units')
    expect(mockUpsert).toHaveBeenCalledWith(input, { onConflict: 'winery_id,unit_type', ignoreDuplicates: false })
    expect(result).toEqual(saved)
  })

  it('throws when upsert fails', async () => {
    const input = { 
      winery_id: 'w-1', 
      unit_type: 'case' as const, 
      bottles_per_case: 6, 
      composition_type: null, 
      pallet_quantity: null,
      discount_pct: 0,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z'
    }

    mockFrom.mockReturnValue({ upsert: mockUpsert })
    mockUpsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: null, error: new Error('Upsert failed') })

    await expect(upsertSellingUnit(input)).rejects.toThrow('Upsert failed')
  })
})

describe('deleteSellingUnit', () => {
  it('deletes a selling unit by id', async () => {
    mockFrom.mockReturnValue({ delete: mockDelete })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })

    await deleteSellingUnit('su-1')

    expect(mockFrom).toHaveBeenCalledWith('selling_units')
    expect(mockEq).toHaveBeenCalledWith('id', 'su-1')
  })

  it('throws when delete fails', async () => {
    mockFrom.mockReturnValue({ delete: mockDelete })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: new Error('Delete failed') })

    await expect(deleteSellingUnit('su-1')).rejects.toThrow('Delete failed')
  })
})

describe('getProductSellingUnits', () => {
  it('returns product selling units for an inventory item', async () => {
    const mockRows = [
      { id: 'psu-1', inventory_id: 'inv-1', selling_unit_id: 'su-1', enabled: true },
      { id: 'psu-2', inventory_id: 'inv-1', selling_unit_id: 'su-2', enabled: false },
    ]
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ data: mockRows, error: null })

    const result = await getProductSellingUnits('inv-1')

    expect(mockFrom).toHaveBeenCalledWith('product_selling_units')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('inventory_id', 'inv-1')
    expect(result).toEqual(mockRows)
  })

  it('returns empty array when no rows exist', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ data: null, error: null })

    const result = await getProductSellingUnits('inv-empty')
    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ data: null, error: new Error('Query error') })

    await expect(getProductSellingUnits('inv-1')).rejects.toThrow('Query error')
  })
})

describe('toggleProductSellingUnit', () => {
  it('upserts product selling unit with enabled flag', async () => {
    mockFrom.mockReturnValue({ upsert: mockUpsert })
    mockUpsert.mockResolvedValue({ error: null })

    await toggleProductSellingUnit('inv-1', 'su-1', true)

    expect(mockFrom).toHaveBeenCalledWith('product_selling_units')
    expect(mockUpsert).toHaveBeenCalledWith(
      { inventory_id: 'inv-1', selling_unit_id: 'su-1', enabled: true },
      { onConflict: 'inventory_id,selling_unit_id' }
    )
  })

  it('throws when toggle fails', async () => {
    mockFrom.mockReturnValue({ upsert: mockUpsert })
    mockUpsert.mockResolvedValue({ error: new Error('Toggle failed') })

    await expect(toggleProductSellingUnit('inv-1', 'su-1', false)).rejects.toThrow('Toggle failed')
  })
})

describe('getEnabledSellingUnitsForProduct', () => {
  it('returns only enabled selling units for a product', async () => {
    const mockData = [
      { selling_units: { id: 'su-1', unit_type: 'bottle', winery_id: 'w-1', bottles_per_case: null, composition_type: null, pallet_quantity: null } },
      { selling_units: { id: 'su-2', unit_type: 'case', winery_id: 'w-1', bottles_per_case: 6, composition_type: null, pallet_quantity: null } },
    ]
    const mockEq2 = vi.fn()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ eq: mockEq2 })
    mockEq2.mockResolvedValue({ data: mockData, error: null })

    const result = await getEnabledSellingUnitsForProduct('inv-1')

    expect(mockFrom).toHaveBeenCalledWith('product_selling_units')
    expect(mockSelect).toHaveBeenCalledWith('selling_units(*)')
    expect(mockEq).toHaveBeenCalledWith('inventory_id', 'inv-1')
    expect(mockEq2).toHaveBeenCalledWith('enabled', true)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('su-1')
  })

  it('returns empty array when no enabled units', async () => {
    const mockEq2 = vi.fn()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ eq: mockEq2 })
    mockEq2.mockResolvedValue({ data: null, error: null })

    const result = await getEnabledSellingUnitsForProduct('inv-empty')
    expect(result).toEqual([])
  })

  it('throws when query fails', async () => {
    const mockEq2 = vi.fn()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ eq: mockEq2 })
    mockEq2.mockResolvedValue({ data: null, error: new Error('Query failed') })

    await expect(getEnabledSellingUnitsForProduct('inv-1')).rejects.toThrow('Query failed')
  })
})
