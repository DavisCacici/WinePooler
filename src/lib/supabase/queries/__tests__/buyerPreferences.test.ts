import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBuyerPreferences, upsertBuyerPreferences } from '../buyerPreferences'

const mockMaybeSingle = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockUpsert = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
})

describe('getBuyerPreferences', () => {
  it('returns preferences when present', async () => {
    const preferences = {
      user_id: 'user-1',
      preferred_wine_types: ['Red'],
      preferred_appellations: ['Barolo'],
      monthly_budget_min: 100,
      monthly_budget_max: 200,
    }
    mockMaybeSingle.mockResolvedValue({ data: preferences, error: null })

    const result = await getBuyerPreferences('user-1')

    expect(mockFrom).toHaveBeenCalledWith('buyer_preferences')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result).toEqual(preferences)
  })

  it('returns null when no preferences exist', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await getBuyerPreferences('user-1')

    expect(result).toBeNull()
  })
})

describe('upsertBuyerPreferences', () => {
  it('calls upsert with expected values and conflict key', async () => {
    const payload = {
      user_id: 'user-1',
      preferred_wine_types: ['Red', 'White'],
      preferred_appellations: ['Barolo'],
      monthly_budget_min: 100,
      monthly_budget_max: 300,
    }

    mockUpsert.mockResolvedValue({ error: null })

    await upsertBuyerPreferences(payload)

    expect(mockFrom).toHaveBeenCalledWith('buyer_preferences')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        ...payload,
        updated_at: expect.any(String),
      }),
      { onConflict: 'user_id' }
    )
  })

  it('throws when upsert fails', async () => {
    mockUpsert.mockResolvedValue({ error: new Error('Upsert failed') })

    await expect(
      upsertBuyerPreferences({
        user_id: 'user-1',
        preferred_wine_types: [],
        preferred_appellations: [],
        monthly_budget_min: null,
        monthly_budget_max: null,
      })
    ).rejects.toThrow('Upsert failed')
  })
})
