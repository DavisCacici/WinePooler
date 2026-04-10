import { describe, expect, it } from 'vitest'
import { palletProgressLabel, palletProgressPercent, palletProgressUnitLabel } from '../palletProgress'

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

describe('palletProgressUnitLabel', () => {
  it('shows case-based label when displayUnit is case', () => {
    expect(palletProgressUnitLabel(42, 360, 'case', 'cases of 6', 6)).toBe('7/60 cases of 6')
  })

  it('floors partial cases', () => {
    expect(palletProgressUnitLabel(43, 360, 'case', 'cases of 6', 6)).toBe('7/60 cases of 6')
  })

  it('falls back to bottles when displayUnit is bottle', () => {
    expect(palletProgressUnitLabel(100, 600, 'bottle', 'bottles', null)).toBe('100/600 bottles')
  })

  it('falls back to bottles when displayUnit is null', () => {
    expect(palletProgressUnitLabel(100, 600, null, null, null)).toBe('100/600 bottles')
  })

  it('falls back to bottles when bottlesPerDisplayUnit is null', () => {
    expect(palletProgressUnitLabel(30, 360, 'case', 'cases', null)).toBe('30/360 bottles')
  })
})
