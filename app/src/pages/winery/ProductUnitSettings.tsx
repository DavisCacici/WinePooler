import { useState, useEffect } from 'react'
import { getWineryInventory } from '../../lib/supabase/queries/wineInventory'
import {
  getSellingUnitsByWinery,
  getProductSellingUnits,
  toggleProductSellingUnit,
  type SellingUnit,
} from '../../lib/supabase/queries/sellingUnits'

interface ProductUnitRow {
  inventoryId: string
  wineLabel: string
  sku: string
  units: {
    sellingUnitId: string
    unitType: 'bottle' | 'case' | 'pallet'
    enabled: boolean
  }[]
}

interface ProductUnitSettingsProps {
  wineryProfileId: string
}

const ProductUnitSettings = ({ wineryProfileId }: ProductUnitSettingsProps) => {
  const [rows, setRows] = useState<ProductUnitRow[]>([])
  const [sellingUnits, setSellingUnits] = useState<SellingUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        const [inventory, units] = await Promise.all([
          getWineryInventory(wineryProfileId),
          getSellingUnitsByWinery(wineryProfileId),
        ])

        if (!mounted) return
        setSellingUnits(units)

        if (inventory.length === 0 || units.length === 0) {
          setRows([])
          setLoading(false)
          return
        }

        // Fetch product_selling_units for all inventory items
        const allPsu = await Promise.all(
          inventory.map((inv) => getProductSellingUnits(inv.id))
        )

        if (!mounted) return

        const built: ProductUnitRow[] = inventory.map((inv, idx) => {
          const psuList = allPsu[idx]
          return {
            inventoryId: inv.id,
            wineLabel: inv.wine_label,
            sku: inv.sku,
            units: units.map((su) => {
              const psu = psuList.find((p) => p.selling_unit_id === su.id)
              return {
                sellingUnitId: su.id,
                unitType: su.unit_type,
                enabled: psu?.enabled ?? true, // default enabled if no row exists
              }
            }),
          }
        })

        setRows(built)
      } catch {
        // silently fail — empty state shown
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadData()
    return () => { mounted = false }
  }, [wineryProfileId])

  const handleToggle = async (inventoryId: string, sellingUnitId: string, currentEnabled: boolean) => {
    const row = rows.find((r) => r.inventoryId === inventoryId)
    if (!row) return

    // Guard: cannot disable the last enabled unit
    const enabledCount = row.units.filter((u) => u.enabled).length
    if (currentEnabled && enabledCount <= 1) return

    const toggleKey = `${inventoryId}-${sellingUnitId}`
    setToggleLoading(toggleKey)

    // Optimistic update
    setRows((prev) =>
      prev.map((r) =>
        r.inventoryId === inventoryId
          ? {
              ...r,
              units: r.units.map((u) =>
                u.sellingUnitId === sellingUnitId ? { ...u, enabled: !currentEnabled } : u
              ),
            }
          : r
      )
    )

    try {
      await toggleProductSellingUnit(inventoryId, sellingUnitId, !currentEnabled)
    } catch {
      // Revert on error
      setRows((prev) =>
        prev.map((r) =>
          r.inventoryId === inventoryId
            ? {
                ...r,
                units: r.units.map((u) =>
                  u.sellingUnitId === sellingUnitId ? { ...u, enabled: currentEnabled } : u
                ),
              }
            : r
        )
      )
    } finally {
      setToggleLoading(null)
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
        <h2 className="text-lg font-semibold text-primary">Product Unit Settings</h2>
        <p className="mt-4 text-sm text-muted">Loading product settings...</p>
      </section>
    )
  }

  if (sellingUnits.length === 0) {
    return (
      <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
        <h2 className="text-lg font-semibold text-primary">Product Unit Settings</h2>
        <p className="mt-4 text-sm text-muted">Define your selling units above before configuring products.</p>
      </section>
    )
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
        <h2 className="text-lg font-semibold text-primary">Product Unit Settings</h2>
        <p className="mt-4 text-sm text-muted">No products to configure. Add wine inventory first.</p>
      </section>
    )
  }

  const unitColumns = sellingUnits.map((su) => su.unit_type)

  return (
    <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
      <h2 className="text-lg font-semibold text-primary">
        <span className="text-accent-winery">Product</span> Unit Settings
      </h2>
      <p className="mt-1 text-sm text-secondary">
        Enable or disable selling units for each product. At least one unit type must remain enabled.
      </p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface-alt text-left text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">Wine Label</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">SKU</th>
              {unitColumns.map((col) => (
                <th key={col} className="px-4 py-3 text-center font-medium text-xs uppercase tracking-wider">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface text-primary">
            {rows.map((row) => {
              const enabledCount = row.units.filter((u) => u.enabled).length
              return (
                <tr key={row.inventoryId}>
                  <td className="px-4 py-3 font-medium">{row.wineLabel}</td>
                  <td className="px-4 py-3 text-muted">{row.sku}</td>
                  {row.units.map((unit) => {
                    const isLastEnabled = unit.enabled && enabledCount <= 1
                    const toggleKey = `${row.inventoryId}-${unit.sellingUnitId}`
                    return (
                      <td key={unit.sellingUnitId} className="px-4 py-3 text-center">
                        <label
                          className="relative inline-flex cursor-pointer items-center"
                          title={isLastEnabled ? 'At least one unit type must be enabled' : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={unit.enabled}
                            disabled={isLastEnabled || toggleLoading === toggleKey}
                            onChange={() => handleToggle(row.inventoryId, unit.sellingUnitId, unit.enabled)}
                            className="peer sr-only"
                            aria-label={`${unit.unitType} for ${row.wineLabel}`}
                          />
                          <div
                            className={`h-6 w-11 rounded-full after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full ${
                              isLastEnabled
                                ? 'bg-amber-600 opacity-50 cursor-not-allowed'
                                : 'bg-stone-300 peer-checked:bg-amber-600'
                            }`}
                          />
                        </label>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default ProductUnitSettings
