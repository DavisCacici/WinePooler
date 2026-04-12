import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../lib/supabase/AuthContext'
import { getBuyerProfile } from '../../lib/supabase/queries/buyerProfile'
import { getBuyerPreferences, type BuyerPreferences } from '../../lib/supabase/queries/buyerPreferences'
import { getPalletsByArea, buyerHasOrderOnPallet } from '../../lib/supabase/queries/virtualPallets'
import { palletProgressLabel, palletProgressUnitLabel } from '../../lib/palletProgress'
import { getSellingUnitsByWinery, computeUnitPrices, type UnitPrice } from '../../lib/supabase/queries/sellingUnits'
import CreatePalletModal from '../pallets/CreatePalletModal'
import AddOrderModal from '../pallets/AddOrderModal'
import FreezeNotification from '../../components/notifications/FreezeNotification'
import PalletPricingBadge from '../../components/pallets/PalletPricingBadge'
import InventoryStatusBadge from '../../components/pallets/InventoryStatusBadge'
import { supabase } from '../../lib/supabase/client'

interface BuyerPalletCard {
  id: string
  palletId: string
  area: string
  winery: string
  wineryId: string
  progress: string
  progressUnitLabel: string
  bottles: number
  threshold: number
  state: 'open' | 'frozen' | 'completed'
  bulkPrice: number | null
  retailPrice: number | null
  availableStock: number | null
  totalStock: number | null
  allocatedBottles: number | null
  inventoryId: string | null
  displayUnit: string | null
  displayUnitLabel: string | null
  bottlesPerDisplayUnit: number | null
  unitPrices: UnitPrice[]
  inventorySyncError?: boolean
}

interface PalletFreezeNotification {
  id: string
  palletId: string
  wineryName: string
  areaName: string
}

const buyerNavigation = [
  'activePallets',
  'areaDemand',
  'myOrders',
  'savedWineries',
  'preferences',
]

export const isPalletPreferred = (
  pallet: { area: string; winery: string },
  prefs: BuyerPreferences | null
): boolean => {
  if (!prefs) {
    return false
  }

  const keywords = prefs.preferred_appellations.map(keyword => keyword.toLowerCase())
  if (keywords.length === 0) {
    return false
  }

  const haystack = `${pallet.area} ${pallet.winery}`.toLowerCase()
  return keywords.some(keyword => haystack.includes(keyword))
}

const BuyerDashboard = () => {
  // const [view, setView] = useState<'map' | 'grid'>('map')
  const [areaId, setAreaId] = useState<string | null>(null)
  const [activeAreaName, setActiveAreaName] = useState<string | null>(null)
  const [pallets, setPallets] = useState<BuyerPalletCard[]>([])
  const [loadingPallets, setLoadingPallets] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [palletRefreshToken, setPalletRefreshToken] = useState(0)
  const [activePalletForOrder, setActivePalletForOrder] = useState<BuyerPalletCard | null>(null)
  const [notifications, setNotifications] = useState<PalletFreezeNotification[]>([])
  const palletsRef = useRef<BuyerPalletCard[]>([])
  const [preferences, setPreferences] = useState<BuyerPreferences | null>(null)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const { user } = useAuth()
  const { t, i18n } = useTranslation('buyerDashboard')
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return

    let isMounted = true

    getBuyerProfile(user.id)
      .then(profile => {
        if (!isMounted) return

        if (!profile) {
          navigate('/profile/complete')
          return
        }

        if (!profile.macro_area_id) {
          navigate('/profile/area')
          return
        }

        setAreaId(profile.macro_area_id)
        setActiveAreaName(profile.macro_area_name ?? null)
      })
      .catch(() => {
        if (isMounted) {
          navigate('/profile/complete')
        }
      })

    return () => {
      isMounted = false
    }
  }, [user, navigate])

  useEffect(() => {
    if (!user) {
      setPreferencesLoaded(true)
      return
    }

    let isMounted = true

    getBuyerPreferences(user.id)
      .then(prefs => {
        if (isMounted) {
          setPreferences(prefs)
        }
      })
      .catch(() => {
        if (isMounted) {
          setPreferences(null)
        }
      })
      .finally(() => {
        if (isMounted) {
          setPreferencesLoaded(true)
        }
      })

    return () => {
      isMounted = false
    }
  }, [user])

  useEffect(() => {
    if (!areaId) {
      return
    }

    let isMounted = true
    setLoadingPallets(true)

    getPalletsByArea(areaId)
      .then(async rows => {
        if (!isMounted) {
          return
        }

        // Batch-fetch selling units per unique winery (O(N wineries) not O(N pallets))
        const uniqueWineryIds = [...new Set(rows.map(r => r.winery_id))]
        const sellingUnitsByWinery = new Map<string, Awaited<ReturnType<typeof getSellingUnitsByWinery>>>()
        await Promise.all(
          uniqueWineryIds.map(wId =>
            getSellingUnitsByWinery(wId)
              .then(units => sellingUnitsByWinery.set(wId, units))
              .catch(() => sellingUnitsByWinery.set(wId, []))
          )
        )

        if (!isMounted) return

        const mapped = rows.map(row => {
          const units = sellingUnitsByWinery.get(row.winery_id) ?? []
          const unitPrices = row.bulk_price_per_bottle
            ? computeUnitPrices(row.bulk_price_per_bottle, row.retail_price_per_bottle, units)
            : []
          return {
            id: row.id,
            palletId: row.id,
            area: row.area_name ?? activeAreaName ?? '',
            winery: row.winery_name ?? t('card.unknownWinery'),
            wineryId: row.winery_id,
            progress: palletProgressLabel(row.bottle_count, row.threshold),
            progressUnitLabel: palletProgressUnitLabel(
              row.bottle_count,
              row.threshold,
              row.display_unit,
              row.display_unit_label,
              row.bottles_per_display_unit,
            ),
            bottles: row.bottle_count,
            threshold: row.threshold,
            state: row.state,
            bulkPrice: row.bulk_price_per_bottle,
            retailPrice: row.retail_price_per_bottle,
            availableStock: row.available_stock,
            totalStock: row.total_stock,
            allocatedBottles: row.allocated_bottles,
            inventoryId: row.inventory_id,
            displayUnit: row.display_unit,
            displayUnitLabel: row.display_unit_label,
            bottlesPerDisplayUnit: row.bottles_per_display_unit,
            unitPrices,
          }
        })

        setPallets(mapped)
      })
      .catch(() => {
        if (isMounted) {
          setPallets([])
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingPallets(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [areaId, palletRefreshToken, activeAreaName, t, i18n.language])

  // Keep palletsRef in sync so the Realtime handler always sees fresh state
  useEffect(() => {
    palletsRef.current = pallets
  }, [pallets])

  useEffect(() => {
    if (!areaId) return

    const channel = supabase
      .channel(`virtual_pallets:area_id=eq.${areaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'virtual_pallets',
          filter: `area_id=eq.${areaId}`,
        },
        (payload: any) => {
          const updated = payload.new as { id: string; bottle_count: number; state: string }
          setPallets(prev =>
            prev.map(p =>
              p.palletId === updated.id
                ? {
                    ...p,
                    bottles: updated.bottle_count,
                    progress: palletProgressLabel(updated.bottle_count, p.threshold),
                    progressUnitLabel: palletProgressUnitLabel(
                      updated.bottle_count,
                      p.threshold,
                      p.displayUnit,
                      p.displayUnitLabel,
                      p.bottlesPerDisplayUnit,
                    ),
                    state: updated.state as BuyerPalletCard['state'],
                  }
                : p
            )
          )

          // Check if pallet just froze and current buyer has an order on it
          if (updated.state === 'frozen' && user) {
            const existing = palletsRef.current.find(p => p.palletId === updated.id)
            const wineryName = existing?.winery ?? ''
            const areaLabel = existing?.area ?? activeAreaName ?? ''
            buyerHasOrderOnPallet(updated.id, user.id)
              .then(hasOrder => {
                if (hasOrder) {
                  setNotifications(prev => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      palletId: updated.id,
                      wineryName,
                      areaName: areaLabel,
                    },
                  ])
                }
              })
              .catch(() => { /* non-blocking */ })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [areaId])

  // Realtime: wine_inventory updates → refresh stock on matching pallet cards
  useEffect(() => {
    if (!areaId) return

    const inventoryChannel = supabase
      .channel(`inventory-area-${areaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wine_inventory',
        },
        (payload: any) => {
          const updated = payload.new as {
            id: string
            total_stock: number
            allocated_bottles: number
          }
          setPallets(prev =>
            prev.map(p =>
              p.inventoryId === updated.id
                ? {
                    ...p,
                    totalStock: updated.total_stock,
                    allocatedBottles: updated.allocated_bottles,
                    availableStock: updated.total_stock - updated.allocated_bottles,
                    inventorySyncError: false,
                  }
                : p
            )
          )
        }
      )
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR') {
          setPallets(prev => prev.map(p => ({ ...p, inventorySyncError: true })))
        }
      })

    return () => {
      supabase.removeChannel(inventoryChannel)
    }
  }, [areaId])

  const handleOrderAdded = (palletId: string, newCount: number, newState: 'open' | 'frozen') => {
    setPallets(prev =>
      prev.map(p =>
        p.palletId === palletId
          ? {
              ...p,
              bottles: newCount,
              progress: palletProgressLabel(newCount, p.threshold),
              progressUnitLabel: palletProgressUnitLabel(
                newCount,
                p.threshold,
                p.displayUnit,
                p.displayUnitLabel,
                p.bottlesPerDisplayUnit,
              ),
              state: newState,
            }
          : p
      )
    )
  }

  const dismissNotification = (id: string) =>
    setNotifications(prev => prev.filter(n => n.id !== id))

  const visiblePallets = activeAreaName ? pallets.filter(pallet => pallet.area === activeAreaName) : pallets
  const hasPreferences =
    preferences !== null &&
    (preferences.preferred_wine_types.length > 0 || preferences.preferred_appellations.length > 0)

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-buyer">
            {t('header.badge', { areaName: activeAreaName ?? t('header.allAreas') })}
          </p>
          {hasPreferences && (
            <span className="mt-3 inline-flex rounded-full border border-success-border bg-success-bg px-3 py-1 text-xs font-medium text-success-text">
              {t('header.preferencesSet')}
            </span>
          )}
          <div className="mt-3 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">{t('header.title')}</h1>
              <p className="mt-2 max-w-2xl text-secondary">
                {t('header.subtitle')}
              </p>
            </div>
            <nav aria-label={t('nav.ariaLabel')} className="flex flex-wrap gap-3">
              {buyerNavigation.map(item => (
                item === 'preferences' ? (
                  <Link
                    key={item}
                    to="/profile/preferences"
                    className="rounded-full border border-border bg-surface-alt px-4 py-2 text-sm font-medium text-secondary"
                  >
                    {t(`nav.${item}`)}
                  </Link>
                ) : (
                  <a
                    key={item}
                    href="#"
                    className="rounded-full border border-border bg-surface-alt px-4 py-2 text-sm font-medium text-secondary"
                  >
                    {t(`nav.${item}`)}
                  </a>
                )
              ))}
              <Link
                to="/profile/area"
                className="rounded-full border border-success-border bg-success-bg px-4 py-2 text-sm font-medium text-success-text"
              >
                {t('nav.changeArea')}
              </Link>
            </nav>
          </div>
          {preferencesLoaded && preferences === null && (
            <p className="mt-3 text-sm text-secondary">
              <Link to="/profile/preferences" className="text-accent-buyer underline">
                {t('preferences.setPreferences')}
              </Link>{' '}
              {t('preferences.highlightHint')}
            </p>
          )}
        </header>

        <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-primary">{t('discovery.title')}</h2>
              <p className="text-sm text-secondary">{t('discovery.subtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded-full border border-accent-buyer bg-accent-buyer px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {t('discovery.newPallet')}
              </button>
            </div>
          </div>

          {loadingPallets && <p className="mt-4 text-sm text-secondary">{t('loadingPallets')}</p>}

    
            <div className="mt-6">
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visiblePallets.map(pallet => (
                  <article
                    key={pallet.id}
                    className={`rounded-2xl border border-border bg-surface-alt p-5 ${
                      isPalletPreferred(pallet, preferences) ? 'ring-2 ring-accent-buyer' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-accent-buyer">{pallet.id}</p>
                      {pallet.state !== 'open' && (
                        <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-secondary">
                          {t(`state.${pallet.state}`)}
                        </span>
                      )}
                    </div>
                    <h4 className="mt-2 text-lg font-semibold text-primary">{pallet.winery}</h4>
                    <p className="mt-1 text-sm text-secondary">{pallet.area}</p>
                    <div className="mt-4 h-2 rounded-full bg-surface-elevated">
                      <div className="h-2 rounded-full bg-accent-buyer" style={{ width: pallet.progress }} />
                    </div>
                    <p className="mt-3 text-sm text-secondary">{pallet.progressUnitLabel}</p>
                    <PalletPricingBadge bulkPrice={pallet.bulkPrice} retailPrice={pallet.retailPrice} unitPrices={pallet.unitPrices} />
                    <InventoryStatusBadge
                      availableStock={pallet.availableStock}
                      allocatedBottles={pallet.allocatedBottles}
                      totalStock={pallet.totalStock}
                      syncError={pallet.inventorySyncError}
                    />
                    <button
                      type="button"
                      disabled={pallet.state !== 'open' || (pallet.availableStock !== null && pallet.availableStock <= 0)}
                      onClick={() => setActivePalletForOrder(pallet)}
                      className="mt-4 w-full rounded-full bg-accent-buyer px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('card.addOrder')}
                    </button>
                  </article>
                ))}
              </div>
            </div>
        </section>

        {showCreateModal && user && areaId && (
          <CreatePalletModal
            areaId={areaId}
            areaName={activeAreaName}
            buyerUserId={user.id}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false)
              setPalletRefreshToken(value => value + 1)
            }}
          />
        )}

        {activePalletForOrder && user && (
          <AddOrderModal
            pallet={{
              id: activePalletForOrder.palletId,
              area_id: areaId ?? '',
              winery_id: activePalletForOrder.wineryId,
              state: activePalletForOrder.state,
              bottle_count: activePalletForOrder.bottles,
              threshold: activePalletForOrder.threshold,
              created_by: '',
              bulk_price_per_bottle: activePalletForOrder.bulkPrice,
              retail_price_per_bottle: activePalletForOrder.retailPrice,
              inventory_id: activePalletForOrder.inventoryId,
              available_stock: activePalletForOrder.availableStock,
              total_stock: activePalletForOrder.totalStock,
              allocated_bottles: activePalletForOrder.allocatedBottles,
              display_unit: activePalletForOrder.displayUnit,
              display_unit_label: activePalletForOrder.displayUnitLabel,
              bottles_per_display_unit: activePalletForOrder.bottlesPerDisplayUnit,
              area_name: activePalletForOrder.area,
              winery_name: activePalletForOrder.winery,
            }}
            buyerUserId={user.id}
            onClose={() => setActivePalletForOrder(null)}
            onOrderAdded={(newCount, newState) => {
              handleOrderAdded(activePalletForOrder.palletId, newCount, newState)
              setActivePalletForOrder(null)
            }}
          />
        )}
      </div>

      {/* Freeze notification stack */}
      <div className="fixed right-4 top-4 z-50 flex w-80 flex-col gap-3">
        {notifications.map(n => (
          <FreezeNotification
            key={n.id}
            wineryName={n.wineryName}
            areaName={n.areaName}
            onDismiss={() => dismissNotification(n.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default BuyerDashboard
