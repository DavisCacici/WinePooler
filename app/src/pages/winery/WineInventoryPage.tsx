import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../lib/supabase/AuthContext'
import { supabase } from '../../lib/supabase/client'
import {
  createWineInventory,
  deleteWineInventory,
  getWineryInventory,
  updateWineInventory,
  type WineInventory,
} from '../../lib/supabase/queries/wineInventory'

interface InventoryFormState {
  wineLabel: string
  sku: string
  totalStock: string
}

const EMPTY_FORM: InventoryFormState = {
  wineLabel: '',
  sku: '',
  totalStock: '',
}

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
  const [form, setForm] = useState<InventoryFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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

  const totalAvailable = useMemo(
    () => rows.reduce((sum, row) => sum + row.available_stock, 0),
    [rows]
  )

  const validationErrors: string[] = []
  if (!form.wineLabel.trim()) validationErrors.push(t('validation.wineLabelRequired'))
  if (!form.sku.trim()) validationErrors.push(t('validation.skuRequired'))
  const parsedStock = Number(form.totalStock)
  if (!Number.isInteger(parsedStock) || parsedStock < 0) {
    validationErrors.push(t('validation.totalStockInvalid'))
  }

  const isValid = validationErrors.length === 0

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || !wineryProfileId) return

    setSaving(true)
    setFeedback(null)

    try {
      if (editingId) {
        const updated = await updateWineInventory(editingId, {
          wine_label: form.wineLabel.trim(),
          sku: form.sku.trim(),
          total_stock: parsedStock,
        })
        setRows(prev => prev.map(row => (row.id === updated.id ? updated : row)))
        setFeedback({ type: 'success', message: t('feedback.updated') })
      } else {
        const created = await createWineInventory({
          winery_id: wineryProfileId,
          wine_label: form.wineLabel.trim(),
          sku: form.sku.trim(),
          total_stock: parsedStock,
        })
        setRows(prev => [...prev, created])
        setFeedback({ type: 'success', message: t('feedback.added') })
      }
      resetForm()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: parseErrorMessage(err, t('errors.saveFailed'), t('errors.duplicateSku')),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (row: WineInventory) => {
    setEditingId(row.id)
    setForm({
      wineLabel: row.wine_label,
      sku: row.sku,
      totalStock: String(row.total_stock),
    })
    setFeedback(null)
  }

  const handleDelete = async (row: WineInventory) => {
    const confirmed = window.confirm(t('confirmDelete', { wineLabel: row.wine_label }))
    if (!confirmed) return

    setDeletingId(row.id)
    setFeedback(null)
    try {
      await deleteWineInventory(row.id)
      setRows(prev => prev.filter(item => item.id !== row.id))
      if (editingId === row.id) resetForm()
      setFeedback({ type: 'success', message: t('feedback.deleted') })
    } catch (err) {
      setFeedback({
        type: 'error',
        message: parseErrorMessage(err, t('errors.deleteFailed'), t('errors.duplicateSku')),
      })
    } finally {
      setDeletingId(null)
    }
  }

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
        </header>

        <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
          <h2 className="text-lg font-semibold text-primary">
            {editingId ? t('form.editTitle') : t('form.addTitle')}
          </h2>
          <form className="mt-5 grid gap-4 md:grid-cols-4" onSubmit={handleSubmit}>
            <div className="md:col-span-2">
              <label htmlFor="wine-label" className="block text-sm font-medium text-secondary">
                {t('form.wineLabel')}
              </label>
              <input
                id="wine-label"
                type="text"
                value={form.wineLabel}
                onChange={(e) => setForm(prev => ({ ...prev, wineLabel: e.target.value }))}
                placeholder={t('form.wineLabelPlaceholder')}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label htmlFor="sku" className="block text-sm font-medium text-secondary">
                {t('form.sku')}
              </label>
              <input
                id="sku"
                type="text"
                value={form.sku}
                onChange={(e) => setForm(prev => ({ ...prev, sku: e.target.value.toUpperCase() }))}
                placeholder={t('form.skuPlaceholder')}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label htmlFor="total-stock" className="block text-sm font-medium text-secondary">
                {t('form.totalStock')}
              </label>
              <input
                id="total-stock"
                type="number"
                min={0}
                step={1}
                value={form.totalStock}
                onChange={(e) => setForm(prev => ({ ...prev, totalStock: e.target.value }))}
                placeholder={t('form.totalStockPlaceholder')}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {validationErrors.length > 0 && (
              <div className="md:col-span-4 rounded-lg bg-error-bg p-3">
                {validationErrors.map(err => (
                  <p key={err} className="text-sm text-error">{err}</p>
                ))}
              </div>
            )}

            {feedback && (
              <p
                className={`md:col-span-4 text-sm ${feedback.type === 'success' ? 'text-success-text' : 'text-error'}`}
                role="status"
              >
                {feedback.message}
              </p>
            )}

            <div className="md:col-span-4 flex gap-3">
              <button
                type="submit"
                disabled={!isValid || saving}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? t('form.save') : editingId ? t('form.updateButton') : t('form.addButton')}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
                >
                  {t('form.cancelEdit')}
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">{t('table.title')}</h2>
            <p className="text-sm text-secondary">{t('table.items', { count: rows.length })}</p>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface-alt text-left text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">{t('table.wineLabel')}</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">{t('table.sku')}</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">{t('table.totalStock')}</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">{t('table.allocated')}</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">{t('table.available')}</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface text-primary">
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-muted">
                      {t('table.empty')}
                    </td>
                  </tr>
                )}
                {sortedRows.map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium">{row.wine_label}</td>
                    <td className="px-4 py-3 text-muted">{row.sku}</td>
                    <td className="px-4 py-3">{row.total_stock}</td>
                    <td className="px-4 py-3">{row.allocated_bottles}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text">
                        {row.available_stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(row)}
                          className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-secondary hover:bg-surface-alt"
                        >
                          {t('table.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          disabled={deletingId === row.id}
                          className="rounded-full border border-error-border bg-surface px-3 py-1 text-xs font-medium text-error hover:bg-error-bg disabled:opacity-50"
                        >
                          {deletingId === row.id ? t('table.deleting') : t('table.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

export default WineInventoryPage