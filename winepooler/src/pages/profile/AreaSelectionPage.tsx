import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/supabase/AuthContext'
import { getMacroAreas, type MacroArea } from '../../lib/supabase/queries/macroAreas'
import { updateBuyerArea } from '../../lib/supabase/queries/buyerProfile'

const AreaSelectionPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [areas, setAreas] = useState<MacroArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submittingAreaId, setSubmittingAreaId] = useState<string | null>(null)

  const loadAreas = async () => {
    setLoading(true)
    setError(null)

    try {
      const loadedAreas = await getMacroAreas()
      setAreas(loadedAreas)
    } catch {
      setError('Unable to load areas. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAreas()
  }, [])

  const handleAreaSelect = async (macroAreaId: string) => {
    if (!user) return

    setSubmittingAreaId(macroAreaId)
    setError(null)

    try {
      await updateBuyerArea(user.id, macroAreaId)
      navigate('/dashboard/buyer')
    } catch {
      setError('Unable to update your area. Please retry.')
      setSubmittingAreaId(null)
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-buyer">Area Selection</p>
          <h1 className="mt-3 text-3xl font-bold text-primary">Choose your macro-area</h1>
          <p className="mt-2 text-secondary">
            Select the territory where your business operates. Your dashboard will show pallets and wineries from this area.
          </p>
        </header>

        {loading ? (
          <section className="grid gap-4 md:grid-cols-2" aria-label="area-loading-skeleton">
            {[1, 2, 3].map(item => (
              <div key={item} className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border animate-pulse">
                <div className="h-4 w-32 rounded bg-surface-elevated" />
                <div className="mt-3 h-3 w-full rounded bg-surface-elevated" />
                <div className="mt-2 h-3 w-4/5 rounded bg-surface-elevated" />
              </div>
            ))}
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {areas.map(area => {
              const isSubmitting = submittingAreaId === area.id

              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => handleAreaSelect(area.id)}
                  disabled={Boolean(submittingAreaId)}
                  className="rounded-3xl bg-surface p-6 text-left shadow-sm ring-1 ring-border transition hover:ring-accent-buyer disabled:opacity-70"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-accent-buyer">{area.name}</p>
                  <p className="mt-2 text-secondary">{area.description ?? 'No description available.'}</p>
                  <p className="mt-4 text-sm font-medium text-primary">
                    {isSubmitting ? 'Saving selection...' : 'Select this area'}
                  </p>
                </button>
              )
            })}
          </section>
        )}

        {error && (
          <div className="rounded-2xl border border-error-border bg-error-bg p-4" role="alert">
            <p className="text-sm text-error">{error}</p>
            {!loading && (
              <button
                type="button"
                onClick={loadAreas}
                className="mt-3 rounded-full border border-error-border bg-surface px-4 py-2 text-sm font-medium text-error"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AreaSelectionPage
