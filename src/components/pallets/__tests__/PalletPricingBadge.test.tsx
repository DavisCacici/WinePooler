import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PalletPricingBadge from '../PalletPricingBadge'
import { computeUnitPrices, type SellingUnit } from '../../../lib/supabase/queries/sellingUnits'

const makeCaseUnit = (bottlesPerCase: number, discountPct = 0): SellingUnit => ({
  id: 'su-case',
  winery_id: 'winery-1',
  unit_type: 'case',
  bottles_per_case: bottlesPerCase,
  composition_type: null,
  pallet_quantity: null,
  discount_pct: discountPct,
  created_at: '',
  updated_at: '',
})

const makePalletUnit = (qty: number, compositionType: 'bottles' | 'cases', discountPct = 0): SellingUnit => ({
  id: 'su-pallet',
  winery_id: 'winery-1',
  unit_type: 'pallet',
  bottles_per_case: null,
  composition_type: compositionType,
  pallet_quantity: qty,
  discount_pct: discountPct,
  created_at: '',
  updated_at: '',
})

describe('computeUnitPrices', () => {
  it('returns only bottle entry when no selling units', () => {
    const prices = computeUnitPrices(8.5, 14, [])
    expect(prices).toHaveLength(1)
    expect(prices[0].unitType).toBe('bottle')
    expect(prices[0].bulkPrice).toBe(8.5)
  })

  it('includes case entry when case unit exists', () => {
    const prices = computeUnitPrices(8.5, null, [makeCaseUnit(6)])
    const caseEntry = prices.find(p => p.unitType === 'case')!
    expect(caseEntry).toBeDefined()
    expect(caseEntry.bottleEquivalent).toBe(6)
    expect(caseEntry.bulkPrice).toBeCloseTo(51.0)
    expect(caseEntry.discountPct).toBe(0)
  })

  it('applies case discount correctly', () => {
    const prices = computeUnitPrices(8.5, null, [makeCaseUnit(6, 5)])
    const caseEntry = prices.find(p => p.unitType === 'case')!
    expect(caseEntry.bulkPrice).toBeCloseTo(51.0 * 0.95)
    expect(caseEntry.discountPct).toBe(5)
  })

  it('includes pallet-of-cases entry with correct bottle equivalent', () => {
    const prices = computeUnitPrices(8.5, null, [makeCaseUnit(6), makePalletUnit(60, 'cases')])
    const palletEntry = prices.find(p => p.unitType === 'pallet')!
    expect(palletEntry.bottleEquivalent).toBe(360) // 60 × 6
    expect(palletEntry.bulkPrice).toBeCloseTo(8.5 * 360)
  })

  it('applies pallet discount independently of case discount', () => {
    const prices = computeUnitPrices(8.5, null, [makeCaseUnit(6, 5), makePalletUnit(60, 'cases', 15)])
    const palletEntry = prices.find(p => p.unitType === 'pallet')!
    expect(palletEntry.discountPct).toBe(15)
    expect(palletEntry.bulkPrice).toBeCloseTo(8.5 * 360 * 0.85)
  })

  it('computes savings percentage when retail > bulk', () => {
    const prices = computeUnitPrices(8.5, 14, [])
    expect(prices[0].savingPct).toBe(39)
  })
})

describe('PalletPricingBadge', () => {
  it('renders both prices and saving badge when both prices present', () => {
    render(<PalletPricingBadge bulkPrice={8.5} retailPrice={14} />)

    expect(screen.getByText(/8,50/)).toBeInTheDocument()
    expect(screen.getByText(/14,00/)).toBeInTheDocument()
    expect(screen.getByText(/-39%/)).toBeInTheDocument()
  })

  it('renders only bulk price when retail is null', () => {
    render(<PalletPricingBadge bulkPrice={8.5} retailPrice={null} />)

    expect(screen.getByText(/8,50/)).toBeInTheDocument()
    expect(screen.queryByText(/-\d+%/)).toBeNull()
  })

  it('renders "Price TBD" when both prices are null', () => {
    render(<PalletPricingBadge bulkPrice={null} retailPrice={null} />)

    expect(screen.getByText(/price tbd/i)).toBeInTheDocument()
  })

  it('calculates saving percentage correctly: 8.50 bulk, 14.00 retail → 39%', () => {
    render(<PalletPricingBadge bulkPrice={8.5} retailPrice={14} />)

    expect(screen.getByText(/-39%/)).toBeInTheDocument()
  })

  it('does not show saving badge when bulk equals retail', () => {
    render(<PalletPricingBadge bulkPrice={10} retailPrice={10} />)

    expect(screen.queryByText(/-\d+%/)).toBeNull()
  })

  it('renders compact mode with only bulk price per bottle', () => {
    render(<PalletPricingBadge bulkPrice={8.5} retailPrice={14} compact />)

    expect(screen.getByText(/8,50.*\/bottle/)).toBeInTheDocument()
    expect(screen.queryByText(/-39%/)).toBeNull()
  })

  it('renders nothing in compact mode when bulk price is null', () => {
    const { container } = render(
      <PalletPricingBadge bulkPrice={null} retailPrice={null} compact />
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders multi-unit pricing when unitPrices has multiple entries', () => {
    const unitPrices = computeUnitPrices(8.5, 14, [makeCaseUnit(6, 5)])
    render(<PalletPricingBadge bulkPrice={8.5} retailPrice={14} unitPrices={unitPrices} />)

    // Should show bottle price
    expect(screen.getByText(/bottle/)).toBeInTheDocument()
    // Should show case entry with Save 5%
    expect(screen.getByText(/Save 5%/)).toBeInTheDocument()
  })

  it('renders compact multi-unit with only primary unit', () => {
    const unitPrices = computeUnitPrices(8.5, 14, [makeCaseUnit(6)])
    render(<PalletPricingBadge bulkPrice={8.5} retailPrice={14} unitPrices={unitPrices} compact />)

    // Compact: only shows first (bottle) price
    expect(screen.getByText(/8,50.*\/bottle/)).toBeInTheDocument()
  })

  it('falls back to single-unit display when unitPrices has one or zero entries', () => {
    const unitPrices = computeUnitPrices(8.5, null, [])
    render(<PalletPricingBadge bulkPrice={8.5} retailPrice={null} unitPrices={unitPrices} />)

    // Should render fallback (single-unit mode)
    expect(screen.getByText(/bulk \/ bottle/i)).toBeInTheDocument()
  })
})
