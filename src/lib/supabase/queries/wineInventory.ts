import type { UpsertWineInventoryInput, WineInventory, WineryInventoryRow } from '../../interfaces/WineInvetory'
import { supabase } from '../client'

const normalizeWineInventory = (inv: any): WineInventory => {
  const allocatedBottles = Number(inv.allocated_bottles ?? 0)
  const allocatedCase = Number(inv.allocated_case ?? inv.total_stock ?? 0)

  return {
    id: inv.id,
    winery_id: inv.winery_id,
    wine_label: inv.wine_label,
    sku: inv.sku,
    description: inv.description ?? null,
    image_url: inv.image_url ?? null,
    allocated_bottles: allocatedBottles,
    price: inv.price ?? null,
    allocated_case: allocatedCase,
    available: inv.available ?? true,
    updated_at: inv.updated_at ?? null,
  }
}

export const getInventoryByPallet = async (palletId: string): Promise<WineInventory | null> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .select('inventory_id, wine_inventory(id, winery_id, wine_label, sku, allocated_bottles, price, allocated_case, available, updated_at)')
    .eq('id', palletId)
    .maybeSingle()

  if (error) throw error
  if (!data?.wine_inventory) return null

  return normalizeWineInventory(data.wine_inventory as any)
}

export const getWineryInventory = async (wineryId: string): Promise<WineInventory[]> => {
  const { data, error } = await supabase
    .from('wine_inventory')
    .select('*')
    .eq('winery_id', wineryId)
    .order('wine_label')

  if (error) throw error
  return (data ?? []).map((inv: any) => normalizeWineInventory(inv))
}

export const getWineInventoryById = async (
  inventoryId: string,
  wineryId: string
): Promise<WineInventory | null> => {
  const { data, error } = await supabase
    .from('wine_inventory')
    .select('*')
    .eq('id', inventoryId)
    .eq('winery_id', wineryId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return normalizeWineInventory(data)
}

export const getWineInventoryByIdPublic = async (
  inventoryId: string
): Promise<WineryInventoryRow | null> => {
  const { data, error } = await supabase
    .from('wine_inventory')
    .select('*, winery_profiles(company_name)')
    .eq('id', inventoryId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return {
    ...normalizeWineInventory(data),
    winery_name: (data as any).winery_profiles?.company_name ?? '-',
  }
}

export const getAllWineryInventory = async (): Promise<WineryInventoryRow[]> => {
  const { data, error } = await supabase
    .from('wine_inventory')
    .select('*, winery_profiles(company_name)')

  if (error) throw error

  return (data ?? [])
    .map((inv: any) => ({
      ...normalizeWineInventory(inv),
      winery_name: inv.winery_profiles?.company_name ?? '-',
    }))
    .sort((a, b) => {
      const wineryOrder = a.winery_name.localeCompare(b.winery_name)
      if (wineryOrder !== 0) return wineryOrder
      return a.wine_label.localeCompare(b.wine_label)
    })
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
      description: input.description ?? null,
      image_url: input.image_url ?? null,
      allocated_bottles: input.allocated_bottles ?? 0,
      price: input.price ?? null,
      allocated_case: input.allocated_case ?? 0,
      available: input.available ?? true,
    })
    .select('*')
    .single()

  if (error) throw error

  return normalizeWineInventory(data)
}

export const updateWineInventory = async (
  inventoryId: string,
  input: Pick<UpsertWineInventoryInput, 'wine_label' | 'sku'>
    & Partial<Pick<UpsertWineInventoryInput, 'price' | 'allocated_case' | 'allocated_bottles' | 'available' | 'image_url' | 'description'>>
): Promise<WineInventory> => {

  const { data, error } = await supabase
    .from('wine_inventory')
    .update({
      wine_label: input.wine_label,
      sku: input.sku,
      description: input.description ?? null,
      image_url: input.image_url ?? null,
      price: input.price ?? null,
      allocated_case: input.allocated_case ?? 0,
      allocated_bottles: input.allocated_bottles ?? 0,
      available: input.available ?? true,
    })
    .eq('id', inventoryId)
    .select('*')
    .single()

  if (error) throw error

  return normalizeWineInventory(data)
}

export const deleteWineInventory = async (inventoryId: string): Promise<void> => {
  const { error } = await supabase
    .from('wine_inventory')
    .delete()
    .eq('id', inventoryId)

  if (error) throw error
}

export const uploadWineInventoryPhoto = async (
  file: File,
  wineryId: string,
  sku: string
): Promise<string> => {
  const sanitizedSku = sku.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'jpg'
  const filePath = `${wineryId}/${Date.now()}-${sanitizedSku}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('wine-inventory')
    .upload(filePath, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('wine-inventory').getPublicUrl(filePath)
  return data.publicUrl
}
