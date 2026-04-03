import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addOrderToPallet,
  buyerHasOrderOnPallet,
  createVirtualPallet,
  getOpenPalletForWinery,
  getPalletById,
  getPalletsByArea,
} from '../virtualPallets'

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockInsert = vi.fn()
const mockSingle = vi.fn()
const mockRpc = vi.fn()

vi.mock('../../client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getPalletsByArea', () => {
  it('filters by area and maps joined fields', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'pal-1',
          area_id: 'area-1',
          winery_id: 'winery-1',
          state: 'open',
          bottle_count: 0,
          threshold: 600,
          created_by: 'user-1',
          bulk_price_per_bottle: 8.5,
          retail_price_per_bottle: 14,
          inventory_id: 'inv-1',
          macro_areas: { name: 'North Milan' },
          winery_profiles: { company_name: 'Cantina Aurora' },
          wine_inventory: { total_stock: 800, allocated_bottles: 432 },
        },
      ],
      error: null,
    })

    const result = await getPalletsByArea('area-1')

    expect(mockFrom).toHaveBeenCalledWith('virtual_pallets')
    expect(mockEq).toHaveBeenCalledWith('area_id', 'area-1')
    expect(result[0].area_name).toBe('North Milan')
    expect(result[0].winery_name).toBe('Cantina Aurora')
    expect(result[0].bulk_price_per_bottle).toBe(8.5)
    expect(result[0].retail_price_per_bottle).toBe(14)
    expect(result[0].inventory_id).toBe('inv-1')
    expect(result[0].available_stock).toBe(368)
    expect(result[0].total_stock).toBe(800)
    expect(result[0].allocated_bottles).toBe(432)
  })
})

describe('createVirtualPallet', () => {
  it('inserts pallet with expected payload', async () => {
    const payload = {
      area_id: 'area-1',
      winery_id: 'winery-1',
      created_by: 'buyer-1',
    }

    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({
      data: {
        id: 'pal-1',
        ...payload,
        state: 'open',
        bottle_count: 0,
        threshold: 600,
      },
      error: null,
    })

    await createVirtualPallet(payload)

    expect(mockInsert).toHaveBeenCalledWith(payload)
  })
})

describe('getOpenPalletForWinery', () => {
  it('returns open pallet when found', async () => {
    const eqArea = vi.fn()
    const eqWinery = vi.fn()
    const eqState = vi.fn()

    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: eqArea })
    eqArea.mockReturnValue({ eq: eqWinery })
    eqWinery.mockReturnValue({ eq: eqState })
    eqState.mockReturnValue({ maybeSingle: mockSingle })
    mockSingle.mockResolvedValue({
      data: {
        id: 'pal-1',
        area_id: 'area-1',
        winery_id: 'winery-1',
        state: 'open',
        bottle_count: 0,
        threshold: 600,
        created_by: 'buyer-1',
      },
      error: null,
    })

    const result = await getOpenPalletForWinery('area-1', 'winery-1')

    expect(result?.id).toBe('pal-1')
  })
})

describe('getPalletById', () => {
  it('returns pallet with joined area and winery names', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockSingle })
    mockSingle.mockResolvedValue({
      data: {
        id: 'pal-1',
        area_id: 'area-1',
        winery_id: 'winery-1',
        state: 'open',
        bottle_count: 100,
        threshold: 600,
        created_by: 'user-1',
        macro_areas: { name: 'North Milan' },
        winery_profiles: { company_name: 'Cantina Aurora' },
      },
      error: null,
    })

    const result = await getPalletById('pal-1')

    expect(mockEq).toHaveBeenCalledWith('id', 'pal-1')
    expect(result?.area_name).toBe('North Milan')
    expect(result?.winery_name).toBe('Cantina Aurora')
    expect(result?.bottle_count).toBe(100)
  })

  it('returns null when pallet not found', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockSingle })
    mockSingle.mockResolvedValue({ data: null, error: null })

    const result = await getPalletById('nonexistent')

    expect(result).toBeNull()
  })
})

describe('addOrderToPallet', () => {
  it('calls add_order_and_increment RPC and returns newCount + newState', async () => {
    mockRpc.mockResolvedValue({
      data: { order_id: 'order-1', new_count: 125, new_state: 'open' },
      error: null,
    })

    const result = await addOrderToPallet('pal-1', 'buyer-1', 25, 'Barolo', 'notes')

    expect(mockRpc).toHaveBeenCalledWith('add_order_and_increment', {
      p_pallet_id: 'pal-1',
      p_buyer_id: 'buyer-1',
      p_quantity: 25,
      p_wine_label: 'Barolo',
      p_notes: 'notes',
    })
    expect(result.newCount).toBe(125)
    expect(result.newState).toBe('open')
  })

  it('returns newState = \'frozen\' when RPC signals freeze', async () => {
    mockRpc.mockResolvedValue({
      data: { order_id: 'order-2', new_count: 600, new_state: 'frozen' },
      error: null,
    })

    const result = await addOrderToPallet('pal-1', 'buyer-1', 25)

    expect(result.newCount).toBe(600)
    expect(result.newState).toBe('frozen')
  })

  it('passes null for optional params when not provided', async () => {
    mockRpc.mockResolvedValue({
      data: { order_id: 'order-3', new_count: 50, new_state: 'open' },
      error: null,
    })

    await addOrderToPallet('pal-1', 'buyer-1', 50)

    expect(mockRpc).toHaveBeenCalledWith('add_order_and_increment', {
      p_pallet_id: 'pal-1',
      p_buyer_id: 'buyer-1',
      p_quantity: 50,
      p_wine_label: null,
      p_notes: null,
    })
  })

  it('throws when RPC returns an error (e.g. pallet not open)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'pallet pal-1 is not open or does not exist' },
    })

    await expect(addOrderToPallet('pal-1', 'buyer-1', 10)).rejects.toMatchObject({
      message: 'pallet pal-1 is not open or does not exist',
    })
  })
})

describe('buyerHasOrderOnPallet', () => {
  const mockLimit = vi.fn()

  it('returns true when buyer has an order on the pallet', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValueOnce({ eq: vi.fn().mockReturnValue({ limit: mockLimit }) })
    mockLimit.mockReturnValue({ maybeSingle: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'order-1' }, error: null })

    // Use simpler chain mock
    const mockEq1 = vi.fn()
    const mockEq2 = vi.fn()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq1 })
    mockEq1.mockReturnValue({ eq: mockEq2 })
    mockEq2.mockReturnValue({ limit: mockLimit })
    mockLimit.mockReturnValue({ maybeSingle: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'order-1' }, error: null })

    const result = await buyerHasOrderOnPallet('pal-1', 'buyer-1')

    expect(result).toBe(true)
    expect(mockEq1).toHaveBeenCalledWith('pallet_id', 'pal-1')
    expect(mockEq2).toHaveBeenCalledWith('buyer_id', 'buyer-1')
  })

  it('returns false when buyer has no order on the pallet', async () => {
    const mockEq1 = vi.fn()
    const mockEq2 = vi.fn()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq1 })
    mockEq1.mockReturnValue({ eq: mockEq2 })
    mockEq2.mockReturnValue({ limit: mockLimit })
    mockLimit.mockReturnValue({ maybeSingle: mockSingle })
    mockSingle.mockResolvedValue({ data: null, error: null })

    const result = await buyerHasOrderOnPallet('pal-1', 'buyer-2')

    expect(result).toBe(false)
  })
})
