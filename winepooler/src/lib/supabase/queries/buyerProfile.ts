import { supabase } from '../client'

export interface BuyerProfile {
  id?: string
  user_id: string
  company_name: string
  vat_number: string
  address_street: string
  address_city: string
  address_country: string
  phone?: string
  macro_area_id?: string | null
  macro_area_name?: string | null
}

export const getBuyerProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('buyer_profiles')
    .select('*, macro_areas(name)')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error

  if (!data) {
    return null
  }

  const macroArea = Array.isArray(data.macro_areas) ? data.macro_areas[0] : data.macro_areas

  return {
    ...data,
    macro_area_name: macroArea?.name ?? null,
  }
}

export const upsertBuyerProfile = async (profile: BuyerProfile) => {
  const { data, error } = await supabase
    .from('buyer_profiles')
    .upsert(profile, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateBuyerArea = async (userId: string, macroAreaId: string): Promise<void> => {
  const { error } = await supabase
    .from('buyer_profiles')
    .update({ macro_area_id: macroAreaId })
    .eq('user_id', userId)

  if (error) throw error
}
