import { supabase } from '../client'

export interface SellingUnit {
  id: string
  winery_id: string
  unit_type: 'bottle' | 'case' | 'pallet'
  bottles_per_case: number | null
  composition_type: 'bottles' | 'cases' | null
  pallet_quantity: number | null
  created_at: string
  updated_at: string
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
