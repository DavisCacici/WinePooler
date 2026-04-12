import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getWineryProfiles, type WineryProfile } from '../../lib/supabase/queries/wineryProfiles'
import {
  createVirtualPallet,
  getOpenPalletForWinery,
} from '../../lib/supabase/queries/virtualPallets'
import { computePalletThreshold } from '../../lib/supabase/queries/sellingUnits'
import { createPortal } from 'react-dom'

interface CreatePalletModalProps {
  areaId: string
  areaName: string | null
  buyerUserId: string
  onClose: () => void
  onCreated: () => void
}

const CreatePalletModal = ({
  areaId,
  areaName,
  buyerUserId,
  onClose,
  onCreated,
}: CreatePalletModalProps) => {
  const [wineries, setWineries] = useState<WineryProfile[]>([])
  const [selectedWineryId, setSelectedWineryId] = useState('')
  const [loadingWineries, setLoadingWineries] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [existingPalletId, setExistingPalletId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bulkPrice, setBulkPrice] = useState('')
  const [retailPrice, setRetailPrice] = useState('')
  const [thresholdLabel, setThresholdLabel] = useState<string | null>(null)

  const loadWineries = async () => {
    setLoadingWineries(true)
    setLoadingError(null)

    try {
      const data = await getWineryProfiles()
      setWineries(data)
      if (data.length > 0) {
        setSelectedWineryId(data[0].id)
      }
    } catch {
      setLoadingError('Failed to load wineries. Please retry.')
    } finally {
      setLoadingWineries(false)
    }
  }

  useEffect(() => {
    loadWineries()
  }, [])

  useEffect(() => {
    if (!selectedWineryId) {
      setThresholdLabel(null)
      return
    }
    let active = true
    computePalletThreshold(selectedWineryId).then(info => {
      if (!active) return
      if (info.displayUnit === 'bottle') {
        setThresholdLabel(`This pallet will hold ${info.threshold} bottles`)
      } else {
        setThresholdLabel(
          `This pallet will hold ${info.threshold / (info.bottlesPerDisplayUnit ?? 1)} ${info.displayUnitLabel} (${info.threshold} bottles)`
        )
      }
    }).catch(() => {
      if (active) setThresholdLabel(null)
    })
    return () => { active = false }
  }, [selectedWineryId])

  const selectedWineryName = useMemo(
    () => wineries.find(winery => winery.id === selectedWineryId)?.company_name ?? '',
    [selectedWineryId, wineries]
  )

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!selectedWineryId) {
      setSubmitError('Please select a winery.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    setExistingPalletId(null)
    setSuccessMessage(null)

    try {
      const existing = await getOpenPalletForWinery(areaId, selectedWineryId)
      if (existing) {
        setSubmitError('An open pallet already exists for this winery in your area.')
        setExistingPalletId(existing.id)
        return
      }

      const thresholdInfo = await computePalletThreshold(selectedWineryId)
      await createVirtualPallet({
        area_id: areaId,
        winery_id: selectedWineryId,
        created_by: buyerUserId,
        threshold: thresholdInfo.threshold,
        display_unit: thresholdInfo.displayUnit,
        display_unit_label: thresholdInfo.displayUnitLabel,
        bottles_per_display_unit: thresholdInfo.bottlesPerDisplayUnit,
        bulk_price_per_bottle: bulkPrice ? parseFloat(bulkPrice) : null,
        retail_price_per_bottle: retailPrice ? parseFloat(retailPrice) : null,
      })

      setSuccessMessage(`Virtual pallet created for ${selectedWineryName}.`)
      onCreated()
    } catch {
      setSubmitError('Unable to create pallet. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-surface p-8 shadow-xl ring-1 ring-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-buyer">Create Pallet</p>
            <h2 className="mt-2 text-2xl font-bold text-primary">Start a new virtual pallet</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1 text-sm text-secondary"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleCreate} className="mt-6 space-y-5">
          <div>
            <label htmlFor="area-name" className="block text-sm font-medium text-secondary">
              Macro-Area
            </label>
            <input
              id="area-name"
              type="text"
              value={areaName ?? 'Current area'}
              readOnly
              className="mt-1 block w-full rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-secondary"
            />
          </div>

          <div>
            <label htmlFor="winery-id" className="block text-sm font-medium text-secondary">
              Winery
            </label>
            <select
              id="winery-id"
              value={selectedWineryId}
              onChange={event => setSelectedWineryId(event.target.value)}
              disabled={loadingWineries || Boolean(loadingError)}
              className="mt-1 block w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-primary"
            >
              {loadingWineries ? (
                <option>Loading wineries...</option>
              ) : (
                wineries.map(winery => (
                  <option key={winery.id} value={winery.id}>
                    {winery.company_name}
                  </option>
                ))
              )}
            </select>

            {loadingError && (
              <div className="mt-2 rounded-xl border border-error-border bg-error-bg p-3">
                <p className="text-sm text-error">{loadingError}</p>
                <button
                  type="button"
                  onClick={loadWineries}
                  className="mt-2 rounded-full border border-error-border bg-surface px-3 py-1 text-sm text-error"
                >
                  Retry
                </button>
              </div>
            )}

            {thresholdLabel && (
              <p className="mt-2 text-xs text-secondary" data-testid="threshold-info">{thresholdLabel}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="bulk-price" className="block text-sm font-medium text-secondary">
                Bulk Price (€/bottle)
              </label>
              <input
                id="bulk-price"
                type="number"
                step="0.01"
                min="0.01"
                value={bulkPrice}
                onChange={event => setBulkPrice(event.target.value)}
                placeholder="e.g. 8.50"
                className="mt-1 block w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-primary"
              />
            </div>
            <div>
              <label htmlFor="retail-price" className="block text-sm font-medium text-secondary">
                Retail Price (€/bottle)
              </label>
              <input
                id="retail-price"
                type="number"
                step="0.01"
                min="0.01"
                value={retailPrice}
                onChange={event => setRetailPrice(event.target.value)}
                placeholder="e.g. 14.00"
                className="mt-1 block w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-primary"
              />
            </div>
          </div>

          {submitError && (
            <div className="rounded-xl border border-error-border bg-error-bg p-3" role="alert">
              <p className="text-sm text-error">{submitError}</p>
              {existingPalletId && (
                <Link to="/dashboard/buyer" className="mt-2 inline-block text-sm text-error underline">
                  View existing open pallet ({existingPalletId.slice(0, 8)})
                </Link>
              )}
            </div>
          )}

          {successMessage && (
            <p className="rounded-xl border border-success-border bg-success-bg p-3 text-sm text-success-text" role="status">
              {successMessage}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border bg-surface-alt px-4 py-2 text-sm font-medium text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingWineries || Boolean(loadingError)}
              className="rounded-full border border-accent-buyer bg-accent-buyer px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Pallet'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default CreatePalletModal
