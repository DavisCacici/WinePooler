import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../lib/supabase/AuthContext'
import {
  getBuyerPreferences,
  upsertBuyerPreferences,
  type BuyerPreferences,
} from '../../lib/supabase/queries/buyerPreferences'
import Button from '../../components/ui/Button'

const WINE_TYPES = ['Red', 'White', 'Sparkling', 'Rose', 'Orange', 'Dessert']
const MAX_APPELLATIONS = 10

type BudgetValidationError = 'minPositive' | 'maxPositive' | 'minGreaterThanMax'

export const validateBudgetRange = (
  min: number | null,
  max: number | null
): BudgetValidationError | null => {
  if (min !== null && min <= 0) {
    return 'minPositive'
  }

  if (max !== null && max <= 0) {
    return 'maxPositive'
  }

  if (min !== null && max !== null && min > max) {
    return 'minGreaterThanMax'
  }

  return null
}

const PurchasingPreferencesForm = () => {
  const { user } = useAuth()
  const { t } = useTranslation('profile')
  const [preferredWineTypes, setPreferredWineTypes] = useState<string[]>([])
  const [preferredAppellations, setPreferredAppellations] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [budgetMin, setBudgetMin] = useState<string>('')
  const [budgetMax, setBudgetMax] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    getBuyerPreferences(user.id)
      .then(prefs => {
        if (!prefs) return

        setPreferredWineTypes(prefs.preferred_wine_types ?? [])
        setPreferredAppellations(prefs.preferred_appellations ?? [])
        setBudgetMin(prefs.monthly_budget_min?.toString() ?? '')
        setBudgetMax(prefs.monthly_budget_max?.toString() ?? '')
      })
      .catch(() => {
        setError(t('purchasingPreferences.errors.loadFailed'))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user, t])

  const budgetValidationError = useMemo(() => {
    const min = budgetMin.trim() ? Number(budgetMin) : null
    const max = budgetMax.trim() ? Number(budgetMax) : null

    if (Number.isNaN(min) || Number.isNaN(max)) {
      return t('purchasingPreferences.errors.budgetNotNumber')
    }

    const rangeError = validateBudgetRange(min, max)
    return rangeError ? t(`purchasingPreferences.errors.${rangeError}`) : null
  }, [budgetMin, budgetMax, t])

  const toggleWineType = (wineType: string) => {
    setPreferredWineTypes(prev =>
      prev.includes(wineType) ? prev.filter(type => type !== wineType) : [...prev, wineType]
    )
  }

  const addTag = (value: string) => {
    const normalized = value.trim()
    if (!normalized) {
      setTagInput('')
      return
    }

    if (preferredAppellations.length >= MAX_APPELLATIONS) {
      setError(
        t('purchasingPreferences.errors.appellationLimit', {
          count: MAX_APPELLATIONS,
        })
      )
      setTagInput('')
      return
    }

    const exists = preferredAppellations.some(
      tag => tag.toLowerCase() === normalized.toLowerCase()
    )

    if (!exists) {
      setPreferredAppellations(prev => [...prev, normalized])
      setError(null)
    }

    setTagInput('')
  }

  const handleTagInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(tagInput)
    }
  }

  const removeTag = (tagToRemove: string) => {
    setPreferredAppellations(prev => prev.filter(tag => tag !== tagToRemove))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!user) {
      setError(t('purchasingPreferences.errors.mustBeLoggedIn'))
      return
    }

    const min = budgetMin.trim() ? Number(budgetMin) : null
    const max = budgetMax.trim() ? Number(budgetMax) : null

    if (Number.isNaN(min) || Number.isNaN(max)) {
      setError(t('purchasingPreferences.errors.budgetNotNumber'))
      return
    }

    const validationError = validateBudgetRange(min, max)
    if (validationError) {
      setError(t(`purchasingPreferences.errors.${validationError}`))
      return
    }

    const payload: BuyerPreferences = {
      user_id: user.id,
      preferred_wine_types: preferredWineTypes,
      preferred_appellations: preferredAppellations,
      monthly_budget_min: min,
      monthly_budget_max: max,
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      await upsertBuyerPreferences(payload)
      setSuccess(t('purchasingPreferences.success.saved'))
    } catch {
      setError(t('purchasingPreferences.errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-alt">
        <p className="text-secondary">{t('purchasingPreferences.loading')}</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-buyer">{t('purchasingPreferences.badge')}</p>
          <h1 className="mt-3 text-3xl font-bold text-primary">{t('purchasingPreferences.title')}</h1>
          <p className="mt-2 text-secondary">
            {t('purchasingPreferences.subtitle')}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-primary">{t('purchasingPreferences.sections.wineTypes')}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WINE_TYPES.map(type => (
                <label key={type} className="flex items-center gap-3 rounded-2xl border border-border bg-surface-alt px-4 py-3">
                  <input
                    type="checkbox"
                    checked={preferredWineTypes.includes(type)}
                    onChange={() => toggleWineType(type)}
                    className="h-4 w-4 rounded border-border-strong"
                  />
                  <span className="text-sm font-medium text-secondary">{t(`purchasingPreferences.wineTypes.${type.toLowerCase()}`)}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary">{t('purchasingPreferences.sections.appellations')}</h2>
            <p className="mt-1 text-sm text-secondary">
              {t('purchasingPreferences.appellations.helper', {
                count: MAX_APPELLATIONS,
              })}
            </p>
            <input
              type="text"
              value={tagInput}
              onChange={event => setTagInput(event.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder={t('purchasingPreferences.appellations.placeholder')}
              className="mt-3 block w-full rounded-xl border border-border px-4 py-2.5 text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-focus"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {preferredAppellations.map(tag => (
                <span key={tag} className="inline-flex items-center gap-2 rounded-full bg-accent-buyer-bg px-3 py-1 text-sm text-accent-buyer-text">
                  {tag}
                  <Button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-full text-accent-buyer-text hover:opacity-70"
                    customStyles
                    aria-label={t('purchasingPreferences.appellations.removeTag', {
                      tag,
                    })}
                  >
                    x
                  </Button>
                </span>
              ))}
            </div>
          </section>

          {/* <section>
            <h2 className="text-lg font-semibold text-primary">{t('purchasingPreferences.budget.title')}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="budget-min" className="block text-sm font-medium text-secondary">{t('purchasingPreferences.budget.minimum')}</label>
                <input
                  id="budget-min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetMin}
                  onChange={event => setBudgetMin(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-border px-4 py-2.5 text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </div>
              <div>
                <label htmlFor="budget-max" className="block text-sm font-medium text-secondary">{t('purchasingPreferences.budget.maximum')}</label>
                <input
                  id="budget-max"
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetMax}
                  onChange={event => setBudgetMax(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-border px-4 py-2.5 text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </div>
            </div>
          </section> */}

          {budgetValidationError && (
            <p className="rounded-xl border border-error-border bg-error-bg px-4 py-3 text-sm text-error" role="alert">
              {budgetValidationError}
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-error-border bg-error-bg px-4 py-3 text-sm text-error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-text" role="status">
              {success}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving || Boolean(budgetValidationError)}
              // className="rounded-full bg-accent-buyer px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t('purchasingPreferences.actions.saving') : t('purchasingPreferences.actions.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PurchasingPreferencesForm
