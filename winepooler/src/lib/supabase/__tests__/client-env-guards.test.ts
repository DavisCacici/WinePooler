import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Supabase client env guards', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws when VITE_SUPABASE_URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key')

    await expect(async () => {
      await import('../client')
    }).rejects.toThrow('Missing VITE_SUPABASE_URL')
  })

  it('throws when VITE_SUPABASE_ANON_KEY is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    await expect(async () => {
      await import('../client')
    }).rejects.toThrow('Missing VITE_SUPABASE_ANON_KEY')
  })
})
