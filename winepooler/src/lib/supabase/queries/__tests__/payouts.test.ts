import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase client
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()

vi.mock('../../client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test' } } }),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}))

import {
  getWineryPayouts,
  getPalletPayoutDetail,
} from '../payouts'
import { supabase } from '../../client'

describe('payouts queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getWineryPayouts', () => {
    it('returns payout rows for a winery', async () => {
      const mockData = [
        {
          id: 'payout-1',
          pallet_id: 'pallet-1',
          winery_id: 'winery-1',
          stripe_transfer_id: 'tr_123',
          gross_amount_cents: 10000,
          commission_amount_cents: 500,
          net_amount_cents: 9500,
          currency: 'eur',
          commission_bps: 500,
          status: 'paid',
          failure_reason: null,
          processed_at: '2026-04-09T00:00:00Z',
          created_at: '2026-04-09T00:00:00Z',
          updated_at: '2026-04-09T00:00:00Z',
        },
      ]

      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ order: mockOrder })
      mockOrder.mockResolvedValue({ data: mockData, error: null })

      const result = await getWineryPayouts('winery-1')
      expect(result).toEqual(mockData)
      expect(supabase.from).toHaveBeenCalledWith('pallet_payouts')
    })

    it('throws on error', async () => {
      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ order: mockOrder })
      mockOrder.mockResolvedValue({ data: null, error: new Error('DB error') })

      await expect(getWineryPayouts('winery-1')).rejects.toThrow('DB error')
    })

    it('returns empty array when no data', async () => {
      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ order: mockOrder })
      mockOrder.mockResolvedValue({ data: null, error: null })

      const result = await getWineryPayouts('winery-1')
      expect(result).toEqual([])
    })
  })

  describe('getPalletPayoutDetail', () => {
    it('returns payout and items', async () => {
      const mockPayout = {
        id: 'payout-1',
        pallet_id: 'pallet-1',
        status: 'paid',
        gross_amount_cents: 10000,
        commission_amount_cents: 500,
        net_amount_cents: 9500,
      }
      const mockItems = [
        { id: 'item-1', payout_id: 'payout-1', payment_authorization_id: 'auth-1', amount_cents: 5000 },
        { id: 'item-2', payout_id: 'payout-1', payment_authorization_id: 'auth-2', amount_cents: 5000 },
      ]

      // First call: get payout
      const fromSpy = vi.mocked(supabase.from)
      fromSpy
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockPayout, error: null }),
            }),
          }),
        } as any)
        // Second call: get items
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
            }),
          }),
        } as any)

      const result = await getPalletPayoutDetail('pallet-1')
      expect(result.payout).toEqual(mockPayout)
      expect(result.items).toEqual(mockItems)
    })

    it('returns null payout and empty items when no payout exists', async () => {
      const fromSpy = vi.mocked(supabase.from)
      fromSpy.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      } as any)

      const result = await getPalletPayoutDetail('pallet-1')
      expect(result.payout).toBeNull()
      expect(result.items).toEqual([])
    })
  })
})

describe('payout math', () => {
  it('commission calculation is deterministic integer math', () => {
    const grossCents = 51000 // €510.00
    const commissionBps = 500 // 5%
    const commissionCents = Math.floor((grossCents * commissionBps) / 10000)
    const netCents = grossCents - commissionCents

    expect(commissionCents).toBe(2550) // €25.50
    expect(netCents).toBe(48450) // €484.50
    expect(commissionCents + netCents).toBe(grossCents) // reconciles
  })

  it('rounding behavior for non-even amounts', () => {
    const grossCents = 33333
    const commissionBps = 500
    const commissionCents = Math.floor((grossCents * commissionBps) / 10000)
    const netCents = grossCents - commissionCents

    expect(commissionCents).toBe(1666) // floor of 1666.65
    expect(netCents).toBe(31667)
    expect(commissionCents + netCents).toBe(grossCents) // always reconciles
  })

  it('zero gross results in zero commission and net', () => {
    const grossCents = 0
    const commissionBps = 500
    const commissionCents = Math.floor((grossCents * commissionBps) / 10000)
    const netCents = grossCents - commissionCents

    expect(commissionCents).toBe(0)
    expect(netCents).toBe(0)
  })
})
