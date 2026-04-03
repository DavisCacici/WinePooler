import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../lib/supabase/AuthContext'
import {
  getBuyerPreferences,
  upsertBuyerPreferences,
  type BuyerPreferences,
} from '../../lib/supabase/queries/buyerPreferences'

const WINE_TYPES = ['Red', 'White', 'Sparkling', 'Rose', 'Orange', 'Dessert']
const MAX_APPELLATIONS = 10

export const validateBudgetRange = (
  min: number | null,
  max: number | null
): string | null => {
  if (min !== null && min <= 0) {
    return 'Minimum budget must be a positive number.'
  }

  if (max !== null && max <= 0) {
    return 'Maximum budget must be a positive number.'
  }

  if (min !== null && max !== null && min > max) {
    return 'Minimum budget cannot be greater than maximum budget.'
  }

  return null
}

const PurchasingPreferencesForm = () => {
  const { user } = useAuth()
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
        setError('Failed to load preferences.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user])

  const budgetValidationError = useMemo(() => {
    const min = budgetMin.trim() ? Number(budgetMin) : null
    const max = budgetMax.trim() ? Number(budgetMax) : null

    if (Number.isNaN(min) || Number.isNaN(max)) {
      return 'Budget values must be numbers.'
    }

    return validateBudgetRange(min, max)
  }, [budgetMin, budgetMax])

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
      setError(`You can add up to ${MAX_APPELLATIONS} appellations.`)
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
      setError('You must be logged in to save preferences.')
      return
    }

    const min = budgetMin.trim() ? Number(budgetMin) : null
    const max = budgetMax.trim() ? Number(budgetMax) : null

    if (Number.isNaN(min) || Number.isNaN(max)) {
      setError('Budget values must be numbers.')
      return
    }

    const validationError = validateBudgetRange(min, max)
    if (validationError) {
      setError(validationError)
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
      setSuccess('Preferences saved successfully.')
    } catch {
      setError('Unable to save preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading preferences...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Buyer Preferences</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Purchasing preferences</h1>
          <p className="mt-2 text-slate-600">
            Set your preferred wine types, appellations, and monthly budget to personalize pallet discovery.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Preferred wine types</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WINE_TYPES.map(type => (
                <label key={type} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={preferredWineTypes.includes(type)}
                    onChange={() => toggleWineType(type)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">{type}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Preferred appellations</h2>
            <p className="mt-1 text-sm text-slate-600">Add up to 10 tags. Press Enter or comma to add.</p>
            <input
              type="text"
              value={tagInput}
              onChange={event => setTagInput(event.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="e.g. Barolo, Brunello"
              className="mt-3 block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {preferredAppellations.map(tag => (
                <span key={tag} className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-full text-emerald-700 hover:text-emerald-900"
                    aria-label={`Remove ${tag}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Monthly budget range (EUR)</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="budget-min" className="block text-sm font-medium text-slate-700">Minimum</label>
                <input
                  id="budget-min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetMin}
                  onChange={event => setBudgetMin(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="budget-max" className="block text-sm font-medium text-slate-700">Maximum</label>
                <input
                  id="budget-max"
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetMax}
                  onChange={event => setBudgetMax(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </section>

          {budgetValidationError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {budgetValidationError}
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
              {success}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || Boolean(budgetValidationError)}
              className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PurchasingPreferencesForm
