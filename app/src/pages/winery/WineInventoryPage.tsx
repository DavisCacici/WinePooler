import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../lib/supabase/AuthContext'
import { supabase } from '../../lib/supabase/client'
import {
  getWineryInventory,
  type WineInventory,
} from '../../lib/supabase/queries/wineInventory'

const PAGE_SIZE = 9

const parseErrorMessage = (err: unknown, fallback: string, duplicateSkuMessage: string) => {
  if (!err || typeof err !== 'object') return fallback
  const maybeMessage = (err as { message?: string }).message
  if (!maybeMessage) return fallback
  if (maybeMessage.toLowerCase().includes('duplicate key value')) {
    return duplicateSkuMessage
  }
  return maybeMessage
}

const WineInventoryPage = () => {
  const { t } = useTranslation('wineryInventory')
  const { user } = useAuth()
  const [wineryProfileId, setWineryProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<WineInventory[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!user) return

    let mounted = true

    const load = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('winery_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) throw error
        if (!mounted) return

        if (!data?.id) {
          setWineryProfileId(null)
          setRows([])
          return
        }

        setWineryProfileId(data.id)
        const inventory = await getWineryInventory(data.id)
        if (!mounted) return
        setRows(inventory)
      } catch (err) {
        if (!mounted) return
        setFeedback({
          type: 'error',
          message: parseErrorMessage(err, t('errors.loadFailed'), t('errors.duplicateSku')),
        })
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [user])

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.wine_label.localeCompare(b.wine_label)),
    [rows]
  )

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const clampedPage = Math.min(currentPage, totalPages)
  const pageRows = useMemo(() => {
    const start = (clampedPage - 1) * PAGE_SIZE
    return sortedRows.slice(start, start + PAGE_SIZE)
  }, [sortedRows, clampedPage])

  const totalAvailable = useMemo(
    () => rows.reduce((sum, row) => sum + row.available_stock, 0),
    [rows]
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  if (loading) {
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-6xl rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <h1 className="text-2xl font-bold text-primary">{t('pageTitle')}</h1>
          <p className="mt-3 text-sm text-secondary">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!wineryProfileId) {
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-6xl rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <h1 className="text-2xl font-bold text-primary">{t('pageTitle')}</h1>
          <p className="mt-3 text-sm text-error">{t('noProfile')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-winery">{t('header.section')}</p>
          <h1 className="mt-3 text-3xl font-bold text-primary">{t('header.title')}</h1>
          <p className="mt-2 text-secondary">
            {t('header.subtitle')}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-2xl border border-border bg-surface-alt p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{t('stats.products')}</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{rows.length}</p>
            </article>
            <article className="rounded-2xl border border-border bg-surface-alt p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{t('stats.totalAvailableBottles')}</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{totalAvailable}</p>
            </article>
          </div>
          <div className="mt-6">
            <Link
              to="/dashboard/winery/inventory/new"
              className="inline-flex rounded-full border border-accent-winery bg-accent-winery px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {t('cards.addProduct')}
            </Link>
          </div>
        </header>

        <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">{t('cards.title')}</h2>
            <p className="text-sm text-secondary">{t('cards.items', { count: rows.length })}</p>
          </div>

          {feedback && (
            <p className={`mt-4 text-sm ${feedback.type === 'success' ? 'text-success-text' : 'text-error'}`} role="status">
              {feedback.message}
            </p>
          )}

          {sortedRows.length === 0 && (
            <p className="mt-5 rounded-2xl border border-border bg-surface-alt p-6 text-center text-muted">
              {t('cards.empty')}
            </p>
          )}

          {sortedRows.length > 0 && (
            <>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pageRows.map(row => (
                  <article key={row.id} className="overflow-hidden rounded-2xl border border-border bg-surface-alt">
                    {row.image_url ? (
                      <img src={row.image_url} alt={row.wine_label} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="flex h-40 items-center justify-center bg-surface-elevated text-sm text-muted">
                        {t('cards.noImage')}
                      </div>
                    )}
                    <div className="space-y-3 p-4">
                      <div>
                        <p className="text-base font-semibold text-primary">{row.wine_label}</p>
                        <p className="text-xs uppercase tracking-wide text-secondary">{row.sku}</p>
                        {row.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-secondary">{row.description}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-surface px-2 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted">{t('cards.total')}</p>
                          <p className="text-sm font-semibold text-primary">{row.total_stock}</p>
                        </div>
                        <div className="rounded-xl bg-surface px-2 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted">{t('cards.allocated')}</p>
                          <p className="text-sm font-semibold text-primary">{row.allocated_bottles}</p>
                        </div>
                        <div className="rounded-xl bg-surface px-2 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted">{t('cards.available')}</p>
                          <p className="text-sm font-semibold text-success-text">{row.available_stock}</p>
                        </div>
                      </div>
                      <Link
                        to={`/dashboard/winery/inventory/${row.id}`}
                        className="inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-elevated"
                      >
                        {t('cards.openDetail')}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-secondary">
                  {t('cards.pageStatus', { page: clampedPage, totalPages })}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={clampedPage <= 1}
                    onClick={() => setCurrentPage(value => Math.max(1, value - 1))}
                    className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('cards.prevPage')}
                  </button>
                  <button
                    type="button"
                    disabled={clampedPage >= totalPages}
                    onClick={() => setCurrentPage(value => Math.min(totalPages, value + 1))}
                    className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('cards.nextPage')}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default WineInventoryPage