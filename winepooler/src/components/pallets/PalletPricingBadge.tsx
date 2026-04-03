interface PalletPricingBadgeProps {
  bulkPrice: number | null
  retailPrice: number | null
  compact?: boolean
}

const formatEur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

const PalletPricingBadge = ({ bulkPrice, retailPrice, compact = false }: PalletPricingBadgeProps) => {
  if (!bulkPrice) {
    return compact ? null : (
      <p className="text-xs text-slate-400">Price TBD</p>
    )
  }

  const savingPct = retailPrice && retailPrice > bulkPrice
    ? Math.round((1 - bulkPrice / retailPrice) * 100)
    : null

  if (compact) {
    return (
      <p className="mt-1 text-xs font-semibold text-emerald-700">
        {formatEur(bulkPrice)}/bottle
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-emerald-700">{formatEur(bulkPrice)}</span>
        <span className="text-xs text-slate-500">bulk / bottle</span>
        {savingPct && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            -{savingPct}%
          </span>
        )}
      </div>
      {retailPrice && (
        <p className="text-xs text-slate-400 line-through">
          Retail {formatEur(retailPrice)}/bottle
        </p>
      )}
    </div>
  )
}

export default PalletPricingBadge
