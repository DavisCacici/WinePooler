import { supabase } from '../client'

export interface VirtualPallet {
  id: string
  area_id: string
  winery_id: string
  state: 'open' | 'frozen' | 'completed'
  bottle_count: number
  threshold: number
  created_by: string
  bulk_price_per_bottle: number | null
  retail_price_per_bottle: number | null
  inventory_id: string | null
  available_stock: number | null
  total_stock: number | null
  allocated_bottles: number | null
  display_unit: string | null
  display_unit_label: string | null
  bottles_per_display_unit: number | null
  area_name?: string
  winery_name?: string
}

export const getPalletsByArea = async (areaId: string): Promise<VirtualPallet[]> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .select(`
      id, area_id, winery_id, state, bottle_count, threshold, created_by,
      bulk_price_per_bottle, retail_price_per_bottle, inventory_id,
      display_unit, display_unit_label, bottles_per_display_unit,
      macro_areas(name),
      winery_profiles(company_name),
      wine_inventory(total_stock, allocated_bottles)
    `)
    .eq('area_id', areaId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    area_id: row.area_id,
    winery_id: row.winery_id,
    state: row.state,
    bottle_count: row.bottle_count,
    threshold: row.threshold,
    created_by: row.created_by,
    bulk_price_per_bottle: row.bulk_price_per_bottle ?? null,
    retail_price_per_bottle: row.retail_price_per_bottle ?? null,
    inventory_id: row.inventory_id ?? null,
    display_unit: row.display_unit ?? null,
    display_unit_label: row.display_unit_label ?? null,
    bottles_per_display_unit: row.bottles_per_display_unit ?? null,
    available_stock: row.wine_inventory
      ? row.wine_inventory.total_stock - row.wine_inventory.allocated_bottles
      : null,
    total_stock: row.wine_inventory?.total_stock ?? null,
    allocated_bottles: row.wine_inventory?.allocated_bottles ?? null,
    area_name: row.macro_areas?.name,
    winery_name: row.winery_profiles?.company_name,
  }))
}

export const getOpenPalletForWinery = async (
  areaId: string,
  wineryId: string
): Promise<VirtualPallet> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .select('id, area_id, winery_id, state, bottle_count, threshold, created_by')
    .eq('area_id', areaId)
    .eq('winery_id', wineryId)
    .eq('state', 'open')
    .maybeSingle()

  if (error) throw error
  return data as VirtualPallet
}

export const createVirtualPallet = async (payload: {
  area_id: string
  winery_id: string
  created_by: string
  threshold?: number
  bulk_price_per_bottle?: number | null
  retail_price_per_bottle?: number | null
  display_unit?: string | null
  display_unit_label?: string | null
  bottles_per_display_unit?: number | null
}): Promise<VirtualPallet> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .insert(payload)
    .select('id, area_id, winery_id, state, bottle_count, threshold, created_by, bulk_price_per_bottle, retail_price_per_bottle, display_unit, display_unit_label, bottles_per_display_unit')
    .single()

  if (error) throw error
  return {
    ...(data as any),
    inventory_id: null,
    available_stock: null,
    total_stock: null,
    allocated_bottles: null,
    display_unit: (data as any).display_unit ?? null,
    display_unit_label: (data as any).display_unit_label ?? null,
    bottles_per_display_unit: (data as any).bottles_per_display_unit ?? null,
  }
}

export const getPalletById = async (palletId: string): Promise<VirtualPallet | null> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .select(`
      id, area_id, winery_id, state, bottle_count, threshold, created_by,
      bulk_price_per_bottle, retail_price_per_bottle, inventory_id,
      display_unit, display_unit_label, bottles_per_display_unit,
      macro_areas(name),
      winery_profiles(company_name)
    `)
    .eq('id', palletId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...(data as any),
    display_unit: (data as any).display_unit ?? null,
    display_unit_label: (data as any).display_unit_label ?? null,
    bottles_per_display_unit: (data as any).bottles_per_display_unit ?? null,
    area_name: (data as any).macro_areas?.name,
    winery_name: (data as any).winery_profiles?.company_name,
  }
}

export const addOrderToPallet = async (
  palletId: string,
  buyerId: string,
  quantity: number,
  wineLabel?: string,
  notes?: string
): Promise<{ newCount: number; newState: 'open' | 'frozen' }> => {
  const { data, error } = await supabase.rpc('add_order_and_increment', {
    p_pallet_id: palletId,
    p_buyer_id: buyerId,
    p_quantity: quantity,
    p_wine_label: wineLabel ?? null,
    p_notes: notes ?? null,
  })

  if (error) throw error

  const result = data as { order_id: string; new_count: number; new_state: string }
  return {
    newCount: result.new_count,
    newState: result.new_state as 'open' | 'frozen',
  }
}

export const buyerHasOrderOnPallet = async (
  palletId: string,
  buyerId: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('pallet_orders')
    .select('id')
    .eq('pallet_id', palletId)
    .eq('buyer_id', buyerId)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data !== null
}

export interface PickingListRow {
  id: string
  state: string
  bottle_count: number
  threshold: number
  area_name: string
  wine_label: string | null
  total_stock: number | null
  allocated_bottles: number | null
  payout_status: string | null
  payout_net_cents: number | null
  payout_commission_cents: number | null
}

export const getWineryPickingList = async (wineryProfileId: string): Promise<PickingListRow[]> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .select(`
      id, state, bottle_count, threshold,
      macro_areas(name),
      wine_inventory(total_stock, allocated_bottles, wine_label),
      pallet_payouts(status, net_amount_cents, commission_amount_cents)
    `)
    .eq('winery_id', wineryProfileId)
    .in('state', ['open', 'frozen', 'completed'])
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    state: row.state,
    bottle_count: row.bottle_count,
    threshold: row.threshold,
    area_name: row.macro_areas?.name ?? '',
    wine_label: row.wine_inventory?.wine_label ?? null,
    total_stock: row.wine_inventory?.total_stock ?? null,
    allocated_bottles: row.wine_inventory?.allocated_bottles ?? null,
    payout_status: row.pallet_payouts?.[0]?.status ?? null,
    payout_net_cents: row.pallet_payouts?.[0]?.net_amount_cents ?? null,
    payout_commission_cents: row.pallet_payouts?.[0]?.commission_amount_cents ?? null,
  }))
}
