import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMacroAreas, invalidateMacroAreasCache } from '../macroAreas'

const mockOrder = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  invalidateMacroAreasCache()
  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ order: mockOrder })
})

describe('getMacroAreas', () => {
  it('returns active areas ordered by display_order with metadata', async () => {
    const mockAreas = [
      { id: '1', name: 'North Milan', slug: 'north-milan', description: 'Desc A', display_order: 1, metadata: null },
      { id: '2', name: 'Lake Garda', slug: 'lake-garda', description: 'Desc B', display_order: 2, metadata: { lat: 45.5 } },
    ]
    mockOrder.mockResolvedValue({ data: mockAreas, error: null })

    const result = await getMacroAreas()

    expect(mockFrom).toHaveBeenCalledWith('macro_areas')
    expect(mockSelect).toHaveBeenCalledWith('id, name, slug, description, display_order, metadata')
    expect(mockEq).toHaveBeenCalledWith('is_active', true)
    expect(mockOrder).toHaveBeenCalledWith('display_order')
    expect(result).toEqual(mockAreas)
  })

  it('returns empty array when supabase returns null data', async () => {
    mockOrder.mockResolvedValue({ data: null, error: null })

    const result = await getMacroAreas()

    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: new Error('Query failed') })

    await expect(getMacroAreas()).rejects.toThrow('Query failed')
  })

  it('returns cached areas on subsequent calls without hitting Supabase', async () => {
    const mockAreas = [
      { id: '1', name: 'North Milan', slug: 'north-milan', description: 'Desc A', display_order: 1, metadata: null },
    ]
    mockOrder.mockResolvedValue({ data: mockAreas, error: null })

    const first = await getMacroAreas()
    const second = await getMacroAreas()

    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })

  it('refetches after cache invalidation', async () => {
    const mockAreas = [
      { id: '1', name: 'Area 1', slug: 'area-1', description: null, display_order: 1, metadata: null },
    ]
    mockOrder.mockResolvedValue({ data: mockAreas, error: null })

    await getMacroAreas()
    expect(mockFrom).toHaveBeenCalledTimes(1)

    invalidateMacroAreasCache()
    await getMacroAreas()
    expect(mockFrom).toHaveBeenCalledTimes(2)
  })
})
