import { supabase } from '../client'

export interface WineInventory {
  id: string
  winery_id: string
  wine_label: string
  sku: string
  total_stock: number
  allocated_bottles: number
  available_stock: number
  updated_at?: string | null
}

export interface UpsertWineInventoryInput {
  winery_id: string
  wine_label: string
  sku: string
  total_stock: number
}

export const getInventoryByPallet = async (palletId: string): Promise<WineInventory | null> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .select('inventory_id, wine_inventory(id, winery_id, wine_label, sku, total_stock, allocated_bottles)')
    .eq('id', palletId)
    .maybeSingle()

  if (error) throw error
  if (!data?.wine_inventory) return null

  const inv = data.wine_inventory as any
  return {
    id: inv.id,
    winery_id: inv.winery_id,
    wine_label: inv.wine_label,
    sku: inv.sku,
    total_stock: inv.total_stock,
    allocated_bottles: inv.allocated_bottles,
    available_stock: inv.total_stock - inv.allocated_bottles,
  }
}

export const getWineryInventory = async (wineryId: string): Promise<WineInventory[]> => {
  const { data, error } = await supabase
    .from('wine_inventory')
    .select('*')
    .eq('winery_id', wineryId)
    .order('wine_label')

  if (error) throw error
  return (data ?? []).map((inv: any) => ({
    ...inv,
    available_stock: inv.total_stock - inv.allocated_bottles,
  }))
}

export const createWineInventory = async (
  input: UpsertWineInventoryInput
): Promise<WineInventory> => {
  const { data, error } = await supabase
    .from('wine_inventory')
    .insert({
      winery_id: input.winery_id,
      wine_label: input.wine_label,
      sku: input.sku,
      total_stock: input.total_stock,
      allocated_bottles: 0,
    })
    .select('*')
    .single()

  if (error) throw error

  return {
    ...data,
    available_stock: data.total_stock - data.allocated_bottles,
  }
}

export const updateWineInventory = async (
  inventoryId: string,
  input: Pick<UpsertWineInventoryInput, 'wine_label' | 'sku' | 'total_stock'>
): Promise<WineInventory> => {
  const { data, error } = await supabase
    .from('wine_inventory')
    .update({
      wine_label: input.wine_label,
      sku: input.sku,
      total_stock: input.total_stock,
    })
    .eq('id', inventoryId)
    .select('*')
    .single()

  if (error) throw error

  return {
    ...data,
    available_stock: data.total_stock - data.allocated_bottles,
  }
}

export const deleteWineInventory = async (inventoryId: string): Promise<void> => {
  const { error } = await supabase
    .from('wine_inventory')
    .delete()
    .eq('id', inventoryId)

  if (error) throw error
}
