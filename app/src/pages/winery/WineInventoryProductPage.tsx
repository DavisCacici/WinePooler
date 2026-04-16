import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../lib/supabase/AuthContext'
import { supabase } from '../../lib/supabase/client'
import {
  createWineInventory,
  deleteWineInventory,
  getWineInventoryById,
  updateWineInventory,
  uploadWineInventoryPhoto,
} from '../../lib/supabase/queries/wineInventory'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

interface ProductFormState {
  wineLabel: string
  sku: string
  description: string
  allocated_case: number
  allocated_bottles?: number
  price: string
  available: boolean
  imageFile: File | null
  imageUrl: string | null
}

const EMPTY_FORM: ProductFormState = {
  wineLabel: '',
  sku: '',
  description: '',
  allocated_case: 0,
  allocated_bottles: 0,
  price: '',
  available: true,
  imageFile: null,
  imageUrl: null,
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

const WineInventoryProductPage = () => {
  const { t } = useTranslation('wineryInventory')
  const { user } = useAuth()
  const navigate = useNavigate()
  const { inventoryId } = useParams<{ inventoryId: string }>()

  const isCreateMode = inventoryId === 'new'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [wineryProfileId, setWineryProfileId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!form.imageFile) {
      setPreviewUrl(form.imageUrl)
      return
    }

    const objectUrl = URL.createObjectURL(form.imageFile)
    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [form.imageFile, form.imageUrl])

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
          return
        }

        setWineryProfileId(data.id)

        if (isCreateMode) {
          setForm(EMPTY_FORM)
          return
        }

        if (!inventoryId) {
          setFeedback({ type: 'error', message: t('errors.loadFailed') })
          return
        }

        const row = await getWineInventoryById(inventoryId, data.id)
        if (!mounted) return

        if (!row) {
          setFeedback({ type: 'error', message: t('product.notFound') })
          return
        }

        setForm({
          wineLabel: row.wine_label,
          sku: row.sku,
          description: row.description ?? '',
          allocated_case: row.allocated_case,
          allocated_bottles: row.allocated_bottles,
          price: row.price === null ? '' : String(row.price),
          available: row.available,
          imageFile: null,
          imageUrl: row.image_url,
        })
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
  }, [user, inventoryId, isCreateMode, t])

  const parsedStock = Number(form.allocated_case)
  const parsedPrice = form.price.trim() === '' ? null : Number(form.price)

  const validationErrors = useMemo(() => {
    const errors: string[] = []
    if (!form.wineLabel.trim()) errors.push(t('validation.wineLabelRequired'))
    if (!form.sku.trim()) errors.push(t('validation.skuRequired'))
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      errors.push(t('validation.allocated_caseInvalid'))
    }
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      errors.push(t('product.validation.priceInvalid'))
    }
    return errors
  }, [form.wineLabel, form.sku, parsedStock, parsedPrice, t])

  const isValid = validationErrors.length === 0

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setForm(prev => ({ ...prev, imageFile: null }))
      return
    }

    setForm(prev => ({ ...prev, imageFile: file }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || !wineryProfileId) return

    setSaving(true)
    setFeedback(null)

    try {
      let nextImageUrl = form.imageUrl

      if (form.imageFile) {
        nextImageUrl = await uploadWineInventoryPhoto(form.imageFile, wineryProfileId, form.sku)
      }

      if (isCreateMode) {
        const created = await createWineInventory({
          winery_id: wineryProfileId,
          wine_label: form.wineLabel.trim(),
          sku: form.sku.trim(),
          description: form.description.trim() || null,
          total_stock: parsedStock,
          allocated_case: parsedStock,
          price: parsedPrice,
          available: form.available,
          image_url: nextImageUrl,
        })
        navigate(`/dashboard/winery/inventory/${created.id}`)
        return
      }

      if (!inventoryId) return

      await updateWineInventory(inventoryId, {
        wine_label: form.wineLabel.trim(),
        sku: form.sku.trim(),
        description: form.description.trim() || null,
        total_stock: parsedStock,
        allocated_case: parsedStock,
        price: parsedPrice,
        available: form.available,
        image_url: nextImageUrl,
      })

      setForm(prev => ({ ...prev, imageUrl: nextImageUrl, imageFile: null }))
      setFeedback({ type: 'success', message: t('feedback.updated') })
    } catch (err) {
      setFeedback({
        type: 'error',
        message: parseErrorMessage(err, t('errors.saveFailed'), t('errors.duplicateSku')),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!inventoryId || isCreateMode) return

    const confirmed = window.confirm(t('confirmDelete', { wineLabel: form.wineLabel || form.sku }))
    if (!confirmed) return

    setDeleting(true)
    setFeedback(null)

    try {
      await deleteWineInventory(inventoryId)
      navigate('/dashboard/winery/inventory')
    } catch (err) {
      setFeedback({
        type: 'error',
        message: parseErrorMessage(err, t('errors.deleteFailed'), t('errors.duplicateSku')),
      })
    } finally {
      setDeleting(false)
    }
  }

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

  if (!wineryProfileId) {
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-5xl rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <h1 className="text-2xl font-bold text-primary">{t('pageTitle')}</h1>
          <p className="mt-3 text-sm text-error">{t('noProfile')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-winery">{t('header.section')}</p>
          <h1 className="mt-3 text-3xl font-bold text-primary">
            {isCreateMode ? t('product.createTitle') : t('product.detailTitle')}
          </h1>
          <p className="mt-2 text-secondary">{t('product.subtitle')}</p>
          <div className="mt-6 flex gap-3">
            <Link
              to="/dashboard/winery/inventory"
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
            >
              {t('product.backToCatalog')}
            </Link>
            {!isCreateMode && (
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={handleDelete}
                disabled={deleting}
                loading={deleting}
              >
                {t('table.delete')}
              </Button>
            )}
          </div>
        </header>

        <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-4 md:col-span-2">
              <div>
                <label htmlFor="wine-label" className="block text-sm font-medium text-secondary">
                  {t('form.wineLabel')}
                </label>
                <input
                  id="wine-label"
                  type="text"
                  value={form.wineLabel}
                  onChange={e => setForm(prev => ({ ...prev, wineLabel: e.target.value }))}
                  placeholder={t('form.wineLabelPlaceholder')}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-secondary">
                  {t('form.description')}
                </label>
                <textarea
                  id="description"
                  rows={4}
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('form.descriptionPlaceholder')}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sku" className="block text-sm font-medium text-secondary">
                {t('form.sku')}
              </label>
              <input
                id="sku"
                type="text"
                value={form.sku}
                onChange={e => setForm(prev => ({ ...prev, sku: e.target.value.toUpperCase() }))}
                placeholder={t('form.skuPlaceholder')}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label htmlFor="total-stock" className="block text-sm font-medium text-secondary">
                {t('form.allocated_case')}
              </label>
              <input
                id="total-stock"
                type="number"
                min={0}
                step={1}
                value={form.allocated_case}
                onChange={e => setForm(prev => ({ ...prev, allocated_case: Number(e.target.value) }))}
                placeholder={t('form.allocated_casePlaceholder')}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <Input
                label={t('product.price')}
                id="price"
                type="number"
                inputSize='md'
                min={0}
                step="0.01"
                value={form.price}
                onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                placeholder={t('product.pricePlaceholder')}
              />
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={e => setForm(prev => ({ ...prev, available: e.target.checked }))}
                  className="h-4 w-4 rounded border-stone-300"
                />
                {t('product.availableLabel')}
              </label>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="photo" className="block text-sm font-medium text-secondary">
                {t('product.photo')}
              </label>
              <input
                id="photo"
                type="file"
                accept="image/*"
                onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="mt-1 text-xs text-muted">{t('product.photoHint')}</p>
            </div>

            {previewUrl && (
              <div className="md:col-span-2">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted">{t('product.preview')}</p>
                <img
                  src={previewUrl}
                  alt={form.wineLabel || form.sku || 'Product image'}
                  className="h-48 w-full rounded-2xl border border-border object-cover md:w-72"
                />
              </div>
            )}

            {validationErrors.length > 0 && (
              <div className="md:col-span-2 rounded-lg bg-error-bg p-3">
                {validationErrors.map(err => (
                  <p key={err} className="text-sm text-error">{err}</p>
                ))}
              </div>
            )}

            {feedback && (
              <p
                className={`md:col-span-2 text-sm ${feedback.type === 'success' ? 'text-success-text' : 'text-error'}`}
                role="status"
              >
                {feedback.message}
              </p>
            )}

            <div className="md:col-span-2 flex gap-3">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!isValid || saving}
                loading={saving}
              >
                {isCreateMode ? t('product.createButton') : t('product.saveButton')}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}

export default WineInventoryProductPage
