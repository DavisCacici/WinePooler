import { useState, useEffect } from 'react'
import {
  getSellingUnitsByWinery,
  upsertSellingUnit,
  deleteSellingUnit,
  type SellingUnit,
} from '../../lib/supabase/queries/sellingUnits'

interface SellingUnitFormState {
  caseEnabled: boolean
  bottlesPerCase: number
  palletEnabled: boolean
  compositionType: 'bottles' | 'cases'
  palletQuantity: number
}

interface SellingUnitConfigProps {
  wineryProfileId: string
}

const SellingUnitConfig = ({ wineryProfileId }: SellingUnitConfigProps) => {
  const [form, setForm] = useState<SellingUnitFormState>({
    caseEnabled: false,
    bottlesPerCase: 6,
    palletEnabled: false,
    compositionType: 'bottles',
    palletQuantity: 60,
  })
  const [existingUnits, setExistingUnits] = useState<SellingUnit[]>([])
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getSellingUnitsByWinery(wineryProfileId)
      .then((units) => {
        if (!mounted) return
        setExistingUnits(units)
        const caseUnit = units.find((u) => u.unit_type === 'case')
        const palletUnit = units.find((u) => u.unit_type === 'pallet')
        setForm({
          caseEnabled: !!caseUnit,
          bottlesPerCase: caseUnit?.bottles_per_case ?? 6,
          palletEnabled: !!palletUnit,
          compositionType: (palletUnit?.composition_type as 'bottles' | 'cases') ?? 'bottles',
          palletQuantity: palletUnit?.pallet_quantity ?? 60,
        })
      })
      .catch(() => {
        if (mounted) setFeedback({ type: 'error', message: 'Failed to load selling units.' })
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [wineryProfileId])

  const validationErrors: string[] = []
  if (form.caseEnabled && form.bottlesPerCase < 2) {
    validationErrors.push('Bottles per case must be at least 2.')
  }
  if (form.palletEnabled && form.palletQuantity < 1) {
    validationErrors.push('Pallet quantity must be at least 1.')
  }
  if (form.palletEnabled && form.compositionType === 'cases' && !form.caseEnabled) {
    validationErrors.push('Cannot set pallet composition to "cases" when case unit is not enabled.')
  }

  const isValid = validationErrors.length === 0

  const handleSave = async () => {
    if (!isValid) return
    setSaving(true)
    setFeedback(null)
    try {
      // Upsert case unit
      if (form.caseEnabled) {
        await upsertSellingUnit({
          winery_id: wineryProfileId,
          unit_type: 'case',
          bottles_per_case: form.bottlesPerCase,
          composition_type: null,
          pallet_quantity: null,
        })
      } else {
        const existing = existingUnits.find((u) => u.unit_type === 'case')
        if (existing) await deleteSellingUnit(existing.id)
      }

      // Upsert pallet unit
      if (form.palletEnabled) {
        await upsertSellingUnit({
          winery_id: wineryProfileId,
          unit_type: 'pallet',
          bottles_per_case: null,
          composition_type: form.compositionType,
          pallet_quantity: form.palletQuantity,
        })
      } else {
        const existing = existingUnits.find((u) => u.unit_type === 'pallet')
        if (existing) await deleteSellingUnit(existing.id)
      }

      // Refresh the cached units
      const refreshed = await getSellingUnitsByWinery(wineryProfileId)
      setExistingUnits(refreshed)
      setFeedback({ type: 'success', message: 'Selling units saved successfully.' })
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message ?? 'Failed to save selling units.' })
    } finally {
      setSaving(false)
    }
  }

  // Compute bottle equivalent summary for pallet
  const palletBottleEquivalent = form.palletEnabled
    ? form.compositionType === 'cases'
      ? `1 pallet = ${form.palletQuantity} cases × ${form.bottlesPerCase} bottles = ${form.palletQuantity * form.bottlesPerCase} bottles`
      : `1 pallet = ${form.palletQuantity} bottles`
    : null

  if (loading) {
    return (
      <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
        <h2 className="text-lg font-semibold text-primary">Selling Unit Configuration</h2>
        <p className="mt-4 text-sm text-muted">Loading selling units...</p>
      </section>
    )
  }

  return (
    <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
      <h2 className="text-lg font-semibold text-primary">
        <span className="text-accent-winery">Selling Units</span> Configuration
      </h2>
      <p className="mt-1 text-sm text-secondary">
        Bottle is always available as the base unit. Configure case and pallet options below.
      </p>

      <div className="mt-6 space-y-6">
        {/* Case configuration */}
        <div className="rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-primary" htmlFor="case-toggle">Case Unit</label>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                id="case-toggle"
                type="checkbox"
                checked={form.caseEnabled}
                onChange={(e) => setForm((prev) => ({ ...prev, caseEnabled: e.target.checked }))}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-stone-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-amber-600 peer-checked:after:translate-x-full" />
            </label>
          </div>
          {form.caseEnabled && (
            <div className="mt-3">
              <label className="block text-sm text-secondary" htmlFor="bottles-per-case">Bottles per Case</label>
              <input
                id="bottles-per-case"
                type="number"
                min={2}
                max={100}
                value={form.bottlesPerCase}
                onChange={(e) => setForm((prev) => ({ ...prev, bottlesPerCase: Number(e.target.value) }))}
                className="mt-1 w-32 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}
        </div>

        {/* Pallet configuration */}
        <div className="rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-primary" htmlFor="pallet-toggle">Pallet Unit</label>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                id="pallet-toggle"
                type="checkbox"
                checked={form.palletEnabled}
                onChange={(e) => setForm((prev) => ({ ...prev, palletEnabled: e.target.checked }))}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-stone-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-amber-600 peer-checked:after:translate-x-full" />
            </label>
          </div>
          {form.palletEnabled && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm text-secondary" htmlFor="composition-type">Composition Type</label>
                <select
                  id="composition-type"
                  value={form.compositionType}
                  onChange={(e) => setForm((prev) => ({ ...prev, compositionType: e.target.value as 'bottles' | 'cases' }))}
                  className="mt-1 w-40 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="bottles">Bottles</option>
                  <option value="cases">Cases</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-secondary" htmlFor="pallet-quantity">Quantity</label>
                <input
                  id="pallet-quantity"
                  type="number"
                  min={1}
                  max={10000}
                  value={form.palletQuantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, palletQuantity: Number(e.target.value) }))}
                  className="mt-1 w-32 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              {palletBottleEquivalent && (
                <p className="text-xs text-muted">{palletBottleEquivalent}</p>
              )}
            </div>
          )}
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="rounded-lg bg-error-bg p-3">
            {validationErrors.map((err) => (
              <p key={err} className="text-sm text-error">{err}</p>
            ))}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <p
            role="status"
            className={`text-sm ${feedback.type === 'success' ? 'text-success-text' : 'text-error'}`}
          >
            {feedback.message}
          </p>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid || saving}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  )
}

export default SellingUnitConfig
