import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/supabase/AuthContext'
import { getWineryPickingList, type PickingListRow } from '../../lib/supabase/queries/virtualPallets'
import { confirmPalletFulfillment, retryPalletPayout } from '../../lib/supabase/queries/payouts'
import { supabase } from '../../lib/supabase/client'

const formatEur = (cents: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)

const WineryDashboard = () => {
  const { user } = useAuth()
  const [pickingLists, setPickingLists] = useState<PickingListRow[]>([])
  const [loadingPicking, setLoadingPicking] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [wineryProfileId, setWineryProfileId] = useState<string | null>(null)

  const refreshPickingList = (profileId: string) => {
    getWineryPickingList(profileId)
      .then(rows => setPickingLists(rows))
      .catch(() => setPickingLists([]))
  }

  useEffect(() => {
    if (!user) return

    let isMounted = true
    setLoadingPicking(true)

    supabase
      .from('winery_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted || !data) {
          if (isMounted) setLoadingPicking(false)
          return
        }
        if (isMounted) setWineryProfileId(data.id)
        getWineryPickingList(data.id)
          .then(rows => {
            if (isMounted) setPickingLists(rows)
          })
          .catch(() => {
            if (isMounted) setPickingLists([])
          })
          .finally(() => {
            if (isMounted) setLoadingPicking(false)
          })
      })
      // .catch(() => {
      //   if (isMounted) setLoadingPicking(false)
      // })

    return () => {
      isMounted = false
    }
  }, [user])

  const handleConfirmFulfillment = async (palletId: string) => {
    setActionLoading(palletId)
    setActionError(null)
    try {
      await confirmPalletFulfillment(palletId)
      if (wineryProfileId) refreshPickingList(wineryProfileId)
    } catch (err: any) {
      setActionError(err?.message ?? 'Failed to confirm fulfillment')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRetryPayout = async (palletId: string) => {
    setActionLoading(palletId)
    setActionError(null)
    try {
      await retryPalletPayout(palletId)
      if (wineryProfileId) refreshPickingList(wineryProfileId)
    } catch (err: any) {
      setActionError(err?.message ?? 'Failed to retry payout')
    } finally {
      setActionLoading(null)
    }
  }

  const netPayoutsCents = pickingLists
    .filter(p => p.payout_status === 'paid' && p.payout_net_cents !== null)
    .reduce((sum, p) => sum + (p.payout_net_cents ?? 0), 0)

  const totalFeesCents = pickingLists
    .filter(p => p.payout_status === 'paid' && p.payout_commission_cents !== null)
    .reduce((sum, p) => sum + (p.payout_commission_cents ?? 0), 0)

  const frozenCount = pickingLists.filter(p => p.state === 'frozen').length
  const openCount = pickingLists.filter(p => p.state === 'open').length

  const dynamicAnalyticsCards = [
    { label: 'Net payouts', value: formatEur(netPayoutsCents), detail: `${pickingLists.filter(p => p.payout_status === 'paid').length} paid pallets` },
    { label: 'Platform fees', value: formatEur(totalFeesCents), detail: 'Commission charged' },
    { label: 'Frozen pallets', value: String(frozenCount), detail: `${openCount} still open` },
  ]

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-winery">Winery Portal</p>
          <h1 className="mt-3 text-3xl font-bold text-primary">Track pallet performance and prepare picking lists</h1>
          <p className="mt-2 max-w-3xl text-secondary">
            Review revenue analytics, identify demand hotspots, and move each frozen pallet into warehouse execution.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {dynamicAnalyticsCards.map(card => (
            <article key={card.label} className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
              <p className="text-sm text-muted">{card.label}</p>
              <p className="mt-3 text-3xl font-bold text-primary">{card.value}</p>
              <p className="mt-2 text-sm text-accent-buyer">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <article className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
            <h2 className="text-xl font-semibold text-primary">Analytics dashboard</h2>
            <ul className="mt-4 space-y-4 text-sm text-secondary">
              <li>Buyer demand is strongest in North Milan and Turin Center.</li>
              <li>Average pallet fill velocity improved by 9% after grouped buyer campaigns.</li>
              <li>Two premium SKUs are under-allocated and should be restocked.</li>
            </ul>
          </article>

          <article className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-primary">Picking lists</h2>
                <p className="text-sm text-secondary">Operational view for pallets that are ready for warehouse action.</p>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-surface-alt text-left text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pallet</th>
                    <th className="px-4 py-3 font-medium">Destination</th>
                    <th className="px-4 py-3 font-medium">Bottles</th>
                    <th className="px-4 py-3 font-medium">Allocated / Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Payout</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface text-primary">
                  {loadingPicking && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-center text-muted">Loading picking lists...</td>
                    </tr>
                  )}
                  {!loadingPicking && pickingLists.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-center text-muted">No pallets ready for picking</td>
                    </tr>
                  )}
                  {pickingLists.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold">{item.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">{item.area_name}</td>
                      <td className="px-4 py-3">{item.bottle_count}</td>
                      <td className="px-4 py-3">
                        {item.allocated_bottles !== null && item.total_stock !== null
                          ? `${item.allocated_bottles} / ${item.total_stock}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.state === 'frozen'
                            ? 'bg-info-bg text-info-text'
                            : item.state === 'completed'
                            ? 'bg-surface-elevated text-secondary'
                            : 'bg-success-bg text-success-text'
                        }`}>
                          {item.state === 'frozen' ? 'Ready to pick' : item.state === 'completed' ? 'Completed' : 'Open'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.payout_status === 'paid' && item.payout_net_cents !== null ? (
                          <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text">
                            {formatEur(item.payout_net_cents)}
                          </span>
                        ) : item.payout_status === 'processing' ? (
                          <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-text">Processing</span>
                        ) : item.payout_status === 'failed' ? (
                          <span className="rounded-full bg-error-bg px-2 py-0.5 text-xs font-medium text-error-text">Failed</span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.state === 'frozen' && !item.payout_status && (
                          <button
                            type="button"
                            onClick={() => handleConfirmFulfillment(item.id)}
                            disabled={actionLoading === item.id}
                            className="rounded-full bg-accent-winery px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {actionLoading === item.id ? 'Processing…' : 'Confirm Shipped'}
                          </button>
                        )}
                        {item.payout_status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRetryPayout(item.id)}
                            disabled={actionLoading === item.id}
                            className="rounded-full border border-error-border bg-surface px-3 py-1 text-xs font-medium text-error hover:bg-error-bg disabled:opacity-50"
                          >
                            {actionLoading === item.id ? 'Retrying…' : 'Retry Payout'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {actionError && (
              <p className="mt-3 text-sm text-error" role="alert">{actionError}</p>
            )}
          </article>
        </section>
      </div>
    </div>
  )
}

export default WineryDashboard
