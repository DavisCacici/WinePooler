import { supabase } from '../client'

export interface SellingUnit {
  id: string
  winery_id: string
  unit_type: 'bottle' | 'case' | 'pallet'
  bottles_per_case: number | null
  composition_type: 'bottles' | 'cases' | null
  pallet_quantity: number | null
  discount_pct: number
  created_at: string
  updated_at: string
}

export interface PalletThresholdInfo {
  threshold: number
  displayUnit: string
  displayUnitLabel: string
  bottlesPerDisplayUnit: number | null
}

/**
 * Computes the pallet threshold (in bottles) from the winery's selling unit config.
 * Falls back to 600 if no pallet unit is defined.
 */
export const computePalletThreshold = async (wineryId: string): Promise<PalletThresholdInfo> => {
  const units = await getSellingUnitsByWinery(wineryId)
  const palletUnit = units.find(u => u.unit_type === 'pallet')

  if (!palletUnit) {
    return { threshold: 600, displayUnit: 'bottle', displayUnitLabel: 'bottles', bottlesPerDisplayUnit: null }
  }

  if (palletUnit.composition_type === 'cases') {
    const caseUnit = units.find(u => u.unit_type === 'case')
    if (!caseUnit || !caseUnit.bottles_per_case || !palletUnit.pallet_quantity) {
      return { threshold: 600, displayUnit: 'bottle', displayUnitLabel: 'bottles', bottlesPerDisplayUnit: null }
    }
    const threshold = palletUnit.pallet_quantity * caseUnit.bottles_per_case
    return {
      threshold,
      displayUnit: 'case',
      displayUnitLabel: `cases of ${caseUnit.bottles_per_case}`,
      bottlesPerDisplayUnit: caseUnit.bottles_per_case,
    }
  }

  // composition_type === 'bottles'
  if (!palletUnit.pallet_quantity) {
    return { threshold: 600, displayUnit: 'bottle', displayUnitLabel: 'bottles', bottlesPerDisplayUnit: null }
  }
  return {
    threshold: palletUnit.pallet_quantity,
    displayUnit: 'bottle',
    displayUnitLabel: 'bottles',
    bottlesPerDisplayUnit: null,
  }
}

export interface ProductSellingUnit {
  id: string
  inventory_id: string
  selling_unit_id: string
  enabled: boolean
  created_at: string
}

export const getSellingUnitsByWinery = async (wineryId: string): Promise<SellingUnit[]> => {
  const { data, error } = await supabase
    .from('selling_units')
    .select('*')
    .eq('winery_id', wineryId)
    .order('unit_type')

  if (error) throw error
  return data ?? []
}

export const upsertSellingUnit = async (
  unit: Omit<SellingUnit, 'id' | 'created_at' | 'updated_at'>
): Promise<SellingUnit> => {
  const { data, error } = await supabase
    .from('selling_units')
    .upsert(unit, { onConflict: 'winery_id,unit_type', ignoreDuplicates: false })
    .select()
    .single()

  if (error) throw error
  return data
}

export const deleteSellingUnit = async (unitId: string): Promise<void> => {
  const { error } = await supabase
    .from('selling_units')
    .delete()
    .eq('id', unitId)

  if (error) throw error
}

export const getProductSellingUnits = async (inventoryId: string): Promise<ProductSellingUnit[]> => {
  const { data, error } = await supabase
    .from('product_selling_units')
    .select('*')
    .eq('inventory_id', inventoryId)

  if (error) throw error
  return data ?? []
}

export const toggleProductSellingUnit = async (
  inventoryId: string,
  sellingUnitId: string,
  enabled: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('product_selling_units')
    .upsert(
      { inventory_id: inventoryId, selling_unit_id: sellingUnitId, enabled },
      { onConflict: 'inventory_id,selling_unit_id' }
    )

  if (error) throw error
}

export const getEnabledSellingUnitsForProduct = async (inventoryId: string): Promise<SellingUnit[]> => {
  const { data, error } = await supabase
    .from('product_selling_units')
    .select('selling_units(*)')
    .eq('inventory_id', inventoryId)
    .eq('enabled', true)

  if (error) throw error
  return (data ?? []).map((row: any) => row.selling_units).filter(Boolean)
}

/**
 * Converts a unit-type + unit-quantity pair into a bottle equivalent count.
 * Throws if the required selling unit definition is not found in sellingUnits.
 */
export const toBottleEquivalent = (
  unitType: string,
  unitQuantity: number,
  sellingUnits: SellingUnit[]
): number => {
  if (unitType === 'bottle') return unitQuantity

  if (unitType === 'case') {
    const caseUnit = sellingUnits.find(u => u.unit_type === 'case')
    if (!caseUnit || !caseUnit.bottles_per_case) {
      throw new Error('Case selling unit not found or has no bottles_per_case')
    }
    return unitQuantity * caseUnit.bottles_per_case
  }

  if (unitType === 'pallet') {
    const palletUnit = sellingUnits.find(u => u.unit_type === 'pallet')
    if (!palletUnit || !palletUnit.pallet_quantity) {
      throw new Error('Pallet selling unit not found or has no pallet_quantity')
    }
    if (palletUnit.composition_type === 'cases') {
      const caseUnit = sellingUnits.find(u => u.unit_type === 'case')
      if (!caseUnit || !caseUnit.bottles_per_case) {
        throw new Error('Case selling unit required for pallet-of-cases conversion')
      }
      return unitQuantity * palletUnit.pallet_quantity * caseUnit.bottles_per_case
    }
    return unitQuantity * palletUnit.pallet_quantity
  }

  throw new Error(`Unknown unit type: ${unitType}`)
}

export interface UnitPrice {
  unitType: string
  unitLabel: string
  bulkPrice: number
  retailPrice: number | null
  savingPct: number | null
  bottleEquivalent: number
  discountPct: number
}

/**
 * Computes per-unit bulk and retail prices from selling unit definitions.
 * Always includes a 'bottle' entry regardless of selling unit config.
 * Discount percentages are badge-only — they do not alter the effective bulk_price_per_bottle.
 */
export const computeUnitPrices = (
  bulkPricePerBottle: number,
  retailPricePerBottle: number | null,
  sellingUnits: SellingUnit[]
): UnitPrice[] => {
  const result: UnitPrice[] = []

  // Bottle (always first)
  result.push({
    unitType: 'bottle',
    unitLabel: 'bottle',
    bulkPrice: bulkPricePerBottle,
    retailPrice: retailPricePerBottle,
    savingPct: retailPricePerBottle && retailPricePerBottle > bulkPricePerBottle
      ? Math.round((1 - bulkPricePerBottle / retailPricePerBottle) * 100)
      : null,
    bottleEquivalent: 1,
    discountPct: 0,
  })

  const caseUnit = sellingUnits.find(u => u.unit_type === 'case')
  if (caseUnit?.bottles_per_case) {
    const equiv = caseUnit.bottles_per_case
    const discountPct = caseUnit.discount_pct ?? 0
    const bulkPrice = bulkPricePerBottle * equiv * (1 - discountPct / 100)
    const retailPrice = retailPricePerBottle ? retailPricePerBottle * equiv : null
    result.push({
      unitType: 'case',
      unitLabel: `case (${equiv} bottles)`,
      bulkPrice,
      retailPrice,
      savingPct: retailPrice && retailPrice > bulkPrice
        ? Math.round((1 - bulkPrice / retailPrice) * 100)
        : null,
      bottleEquivalent: equiv,
      discountPct,
    })
  }

  const palletUnit = sellingUnits.find(u => u.unit_type === 'pallet')
  if (palletUnit?.pallet_quantity) {
    let equiv = palletUnit.pallet_quantity
    if (palletUnit.composition_type === 'cases' && caseUnit?.bottles_per_case) {
      equiv = palletUnit.pallet_quantity * caseUnit.bottles_per_case
    }
    const discountPct = palletUnit.discount_pct ?? 0
    const bulkPrice = bulkPricePerBottle * equiv * (1 - discountPct / 100)
    const retailPrice = retailPricePerBottle ? retailPricePerBottle * equiv : null
    const palletLabel = palletUnit.composition_type === 'cases' && caseUnit?.bottles_per_case
      ? `pallet (${palletUnit.pallet_quantity} cases)`
      : `pallet (${equiv} bottles)`
    result.push({
      unitType: 'pallet',
      unitLabel: palletLabel,
      bulkPrice,
      retailPrice,
      savingPct: retailPrice && retailPrice > bulkPrice
        ? Math.round((1 - bulkPrice / retailPrice) * 100)
        : null,
      bottleEquivalent: equiv,
      discountPct,
    })
  }

  return result
}
