import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase client before importing payments module
vi.mock('../../client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            then: vi.fn(),
          })),
          maybeSingle: vi.fn(),
        })),
      })),
    })),
  },
}))

import { supabase } from '../../client'
import {
  createEscrowPaymentIntent,
  commitAuthorizedOrder,
} from '../payments'

describe('createEscrowPaymentIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when not authenticated', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)

    await expect(createEscrowPaymentIntent('pallet-1', 6)).rejects.toThrow('Not authenticated')
  })

  it('calls edge function with correct body', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'tok' } },
      error: null,
    } as any)

    const mockResponse = {
      data: {
        clientSecret: 'pi_xxx_secret_yyy',
        paymentIntentId: 'pi_xxx',
        amountCents: 5100,
      },
      error: null,
    }
    vi.mocked(supabase.functions.invoke).mockResolvedValue(mockResponse as any)

    const result = await createEscrowPaymentIntent('pallet-1', 6)

    expect(supabase.functions.invoke).toHaveBeenCalledWith('create-escrow-payment-intent', {
      body: { palletId: 'pallet-1', quantity: 6 },
    })
    expect(result.clientSecret).toBe('pi_xxx_secret_yyy')
    expect(result.amountCents).toBe(5100)
  })

  it('throws on edge function error', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'tok' } },
      error: null,
    } as any)

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'Pallet has no valid pricing' },
    } as any)

    await expect(createEscrowPaymentIntent('pallet-1', 6)).rejects.toThrow('Pallet has no valid pricing')
  })
})

describe('commitAuthorizedOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when not authenticated', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)

    await expect(
      commitAuthorizedOrder({
        palletId: 'pallet-1',
        quantity: 6,
        paymentIntentId: 'pi_xxx',
      })
    ).rejects.toThrow('Not authenticated')
  })

  it('calls edge function with correct body', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'tok' } },
      error: null,
    } as any)

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { orderId: 'order-1', authorizationId: 'auth-1', newCount: 12, newState: 'open' },
      error: null,
    } as any)

    const result = await commitAuthorizedOrder({
      palletId: 'pallet-1',
      quantity: 6,
      paymentIntentId: 'pi_xxx',
      wineLabel: 'Barolo',
    })

    expect(supabase.functions.invoke).toHaveBeenCalledWith('commit-authorized-order', {
      body: {
        palletId: 'pallet-1',
        quantity: 6,
        paymentIntentId: 'pi_xxx',
        wineLabel: 'Barolo',
      },
    })
    expect(result.orderId).toBe('order-1')
    expect(result.newState).toBe('open')
  })

  it('throws pallet conflict error', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'tok' } },
      error: null,
    } as any)

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { error: 'Pallet is no longer available', code: 'PALLET_CONFLICT' },
      error: { message: 'Conflict' },
    } as any)

    await expect(
      commitAuthorizedOrder({
        palletId: 'pallet-1',
        quantity: 6,
        paymentIntentId: 'pi_xxx',
      })
    ).rejects.toThrow('no longer available')
  })
})
