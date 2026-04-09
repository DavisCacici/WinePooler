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
      .catch(() => {
        if (isMounted) setLoadingPicking(false)
      })

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
    <div className="min-h-screen bg-stone-50 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-stone-200">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Winery Portal</p>
          <h1 className="mt-3 text-3xl font-bold text-stone-900">Track pallet performance and prepare picking lists</h1>
          <p className="mt-2 max-w-3xl text-stone-600">
            Review revenue analytics, identify demand hotspots, and move each frozen pallet into warehouse execution.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {dynamicAnalyticsCards.map(card => (
            <article key={card.label} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <p className="text-sm text-stone-500">{card.label}</p>
              <p className="mt-3 text-3xl font-bold text-stone-900">{card.value}</p>
              <p className="mt-2 text-sm text-emerald-700">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <h2 className="text-xl font-semibold text-stone-900">Analytics dashboard</h2>
            <ul className="mt-4 space-y-4 text-sm text-stone-700">
              <li>Buyer demand is strongest in North Milan and Turin Center.</li>
              <li>Average pallet fill velocity improved by 9% after grouped buyer campaigns.</li>
              <li>Two premium SKUs are under-allocated and should be restocked.</li>
            </ul>
          </article>

          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">Picking lists</h2>
                <p className="text-sm text-stone-600">Operational view for pallets that are ready for warehouse action.</p>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200">
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-100 text-left text-stone-600">
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
                <tbody className="divide-y divide-stone-200 bg-white text-stone-800">
                  {loadingPicking && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-center text-stone-500">Loading picking lists...</td>
                    </tr>
                  )}
                  {!loadingPicking && pickingLists.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-center text-stone-500">No pallets ready for picking</td>
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
                            ? 'bg-blue-100 text-blue-700'
                            : item.state === 'completed'
                            ? 'bg-stone-100 text-stone-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.state === 'frozen' ? 'Ready to pick' : item.state === 'completed' ? 'Completed' : 'Open'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.payout_status === 'paid' && item.payout_net_cents !== null ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {formatEur(item.payout_net_cents)}
                          </span>
                        ) : item.payout_status === 'processing' ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Processing</span>
                        ) : item.payout_status === 'failed' ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Failed</span>
                        ) : (
                          <span className="text-xs text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.state === 'frozen' && !item.payout_status && (
                          <button
                            type="button"
                            onClick={() => handleConfirmFulfillment(item.id)}
                            disabled={actionLoading === item.id}
                            className="rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            {actionLoading === item.id ? 'Processing…' : 'Confirm Shipped'}
                          </button>
                        )}
                        {item.payout_status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRetryPayout(item.id)}
                            disabled={actionLoading === item.id}
                            className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
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
              <p className="mt-3 text-sm text-red-600" role="alert">{actionError}</p>
            )}
          </article>
        </section>
      </div>
    </div>
  )
}

export default WineryDashboard
