import { describe, expect, it } from 'vitest'
import { palletProgressLabel, palletProgressPercent } from '../palletProgress'

describe('palletProgressPercent', () => {
  it('calculates rounded percent', () => {
    expect(palletProgressPercent(300, 600)).toBe(50)
    expect(palletProgressPercent(1, 3)).toBe(33)
  })

  it('caps values at 100', () => {
    expect(palletProgressPercent(700, 600)).toBe(100)
  })

  it('returns 0 when threshold is invalid', () => {
    expect(palletProgressPercent(100, 0)).toBe(0)
  })
})

describe('palletProgressLabel', () => {
  it('formats percent label', () => {
    expect(palletProgressLabel(300, 600)).toBe('50%')
  })
})
