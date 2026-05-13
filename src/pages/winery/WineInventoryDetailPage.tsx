import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getWineInventoryByIdPublic } from '../../lib/supabase/queries/wineInventory'
import type { WineryInventoryRow } from '../../lib/interfaces/WineInvetory'

const WineInventoryDetailPage = () => {
  const { t } = useTranslation('wineryInventory')
  const { inventoryId } = useParams<{ inventoryId: string }>()

  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<WineryInventoryRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!inventoryId) {
      setError(t('detail.notFound'))
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)

    getWineInventoryByIdPublic(inventoryId)
      .then(row => {
        if (!mounted) return
        if (!row) {
          setError(t('detail.notFound'))
        } else {
          setProduct(row)
        }
      })
      .catch(() => {
        if (!mounted) return
        setError(t('errors.loadFailed'))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [inventoryId, t])

  if (loading) {
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-5xl rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <h1 className="text-2xl font-bold text-primary">{t('product.loadingTitle')}</h1>
          <p className="mt-3 text-sm text-secondary">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-5xl rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <p className="text-sm text-error">{error ?? t('detail.notFound')}</p>
          <Link
            to="/dashboard/buyer"
            className="mt-4 inline-block rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
          >
            {t('detail.backToDashboard')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-winery">
            {product.winery_name}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-primary">{product.wine_label}</h1>
          {product.description && (
            <p className="mt-2 text-secondary">{product.description}</p>
          )}
          <div className="mt-6 flex gap-3">
            <Link
              to="/dashboard/buyer"
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
            >
              {t('detail.backToDashboard')}
            </Link>
          </div>
        </header>

        <section className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <div className="grid gap-8 md:grid-cols-2">
            {product.image_url && (
              <div className="md:col-span-2">
                <img
                  src={product.image_url}
                  alt={product.wine_label}
                  className="h-64 w-full rounded-2xl border border-border object-cover md:w-96"
                />
              </div>
            )}

            <div className="space-y-4">
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('table.sku')}
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-medium text-primary">{product.sku}</dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('detail.availability')}
                  </dt>
                  <dd className="mt-1">
                    {product.available ? (
                      <span className="inline-flex items-center rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-medium text-success-text">
                        {t('detail.available')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-error-bg px-2.5 py-0.5 text-xs font-medium text-error">
                        {t('detail.notAvailable')}
                      </span>
                    )}
                  </dd>
                </div>

                {product.price !== null && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {t('product.price')}
                    </dt>
                    <dd className="mt-1 text-lg font-bold text-primary">
                      €{product.price.toFixed(2)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="space-y-4">
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('form.allocated_case')}
                  </dt>
                  <dd className="mt-1 text-sm text-primary">{product.allocated_case}</dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('detail.allocatedBottles')}
                  </dt>
                  <dd className="mt-1 text-sm text-primary">{product.allocated_bottles}</dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('detail.availableStock')}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-primary">{product.allocated_case}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default WineInventoryDetailPage
