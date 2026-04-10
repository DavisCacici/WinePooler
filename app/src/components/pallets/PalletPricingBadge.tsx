import type { UnitPrice } from '../../lib/supabase/queries/sellingUnits'

interface PalletPricingBadgeProps {
  bulkPrice: number | null
  retailPrice: number | null
  unitPrices?: UnitPrice[]
  compact?: boolean
}

const formatEur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

const PalletPricingBadge = ({ bulkPrice, retailPrice, unitPrices, compact = false }: PalletPricingBadgeProps) => {
  // Multi-unit mode: use unitPrices when provided and has more than one entry
  if (unitPrices && unitPrices.length > 1) {
    if (compact) {
      const primary = unitPrices[0]
      return (
        <p className="mt-1 text-xs font-semibold text-accent-buyer">
          {formatEur(primary.bulkPrice)}/{primary.unitLabel}
        </p>
      )
    }

    return (
      <div className="mt-3 space-y-1.5">
        {unitPrices.map(up => (
          <div key={up.unitType} className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-accent-buyer">{formatEur(up.bulkPrice)}</span>
            <span className="text-xs text-muted">/ {up.unitLabel}</span>
            {up.discountPct > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Save {up.discountPct}%
              </span>
            )}
            {up.savingPct !== null && up.discountPct === 0 && (
              <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text">
                -{up.savingPct}% vs retail
              </span>
            )}
          </div>
        ))}
        {unitPrices[0].retailPrice && (
          <p className="text-xs text-muted line-through">
            Retail {formatEur(unitPrices[0].retailPrice)}/bottle
          </p>
        )}
      </div>
    )
  }

  // Single-unit fallback (original behaviour)
  if (!bulkPrice) {
    return compact ? null : (
      <p className="text-xs text-muted">Price TBD</p>
    )
  }

  const savingPct = retailPrice && retailPrice > bulkPrice
    ? Math.round((1 - bulkPrice / retailPrice) * 100)
    : null

  if (compact) {
    return (
      <p className="mt-1 text-xs font-semibold text-accent-buyer">
        {formatEur(bulkPrice)}/bottle
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-accent-buyer">{formatEur(bulkPrice)}</span>
        <span className="text-xs text-muted">bulk / bottle</span>
        {savingPct && (
          <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text">
            -{savingPct}%
          </span>
        )}
      </div>
      {retailPrice && (
        <p className="text-xs text-muted line-through">
          Retail {formatEur(retailPrice)}/bottle
        </p>
      )}
    </div>
  )
}

export default PalletPricingBadge
