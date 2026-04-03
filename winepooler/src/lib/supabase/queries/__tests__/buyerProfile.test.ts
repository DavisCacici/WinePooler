import { vi, describe, it, expect, beforeEach } from 'vitest'
import { getBuyerProfile, upsertBuyerProfile, updateBuyerArea } from '../buyerProfile'

const mockMaybeSingle = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockUpsert = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()

  mockFrom.mockImplementation((table: string) => {
    if (table === 'buyer_profiles') {
      return {
        select: mockSelect,
        upsert: mockUpsert,
        update: mockUpdate,
      }
    }

    return {
      select: mockSelect,
    }
  })
})

describe('getBuyerProfile', () => {
  it('returns profile data when it exists', async () => {
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })

    const mockProfile = {
      id: 'profile-1',
      user_id: 'user-1',
      company_name: 'Acme SRL',
      vat_number: 'IT12345678901',
      address_street: 'Via Roma 1',
      address_city: 'Milan',
      address_country: 'IT',
      phone: '+39 02 1234567',
      macro_area_id: 'area-1',
      macro_areas: { name: 'North Milan' },
    }
    mockMaybeSingle.mockResolvedValue({ data: mockProfile, error: null })

    const result = await getBuyerProfile('user-1')

    expect(mockFrom).toHaveBeenCalledWith('buyer_profiles')
    expect(mockSelect).toHaveBeenCalledWith('*, macro_areas(name)')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result).toEqual({
      ...mockProfile,
      macro_area_name: 'North Milan',
    })
  })

  it('returns null when no profile exists', async () => {
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await getBuyerProfile('user-unknown')

    expect(result).toBeNull()
  })

  it('throws an error when Supabase returns an error', async () => {
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('DB error') })

    await expect(getBuyerProfile('user-1')).rejects.toThrow('DB error')
  })
})

describe('upsertBuyerProfile', () => {
  const validProfile = {
    user_id: 'user-1',
    company_name: 'Acme SRL',
    vat_number: 'IT12345678901',
    address_street: 'Via Roma 1',
    address_city: 'Milan',
    address_country: 'IT',
  }

  it('inserts and returns the profile', async () => {
    mockUpsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })

    const savedProfile = { id: 'profile-1', ...validProfile }
    mockSingle.mockResolvedValue({ data: savedProfile, error: null })

    const result = await upsertBuyerProfile(validProfile)

    expect(mockFrom).toHaveBeenCalledWith('buyer_profiles')
    expect(mockUpsert).toHaveBeenCalledWith(validProfile, { onConflict: 'user_id' })
    expect(result).toEqual(savedProfile)
  })

  it('updates an existing profile (upsert on conflict)', async () => {
    mockUpsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })

    const updatedProfile = { id: 'profile-1', ...validProfile, company_name: 'Updated SRL' }
    mockSingle.mockResolvedValue({ data: updatedProfile, error: null })

    const result = await upsertBuyerProfile({ ...validProfile, company_name: 'Updated SRL' })

    expect(mockUpsert).toHaveBeenCalledWith(
      { ...validProfile, company_name: 'Updated SRL' },
      { onConflict: 'user_id' }
    )
    expect(result).toEqual(updatedProfile)
  })

  it('throws an error when Supabase returns an error', async () => {
    mockUpsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: null, error: new Error('Insert failed') })

    await expect(upsertBuyerProfile(validProfile)).rejects.toThrow('Insert failed')
  })
})

describe('updateBuyerArea', () => {
  it('updates macro_area_id for current buyer', async () => {
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })

    await updateBuyerArea('user-1', 'area-1')

    expect(mockFrom).toHaveBeenCalledWith('buyer_profiles')
    expect(mockUpdate).toHaveBeenCalledWith({ macro_area_id: 'area-1' })
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('throws when update fails', async () => {
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: new Error('Update failed') })

    await expect(updateBuyerArea('user-1', 'area-2')).rejects.toThrow('Update failed')
  })
})
