import { supabase } from '../client'

export interface WineInventory {
  id: string
  winery_id: string
  wine_label: string
  sku: string
  total_stock: number
  allocated_bottles: number
  available_stock: number
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
