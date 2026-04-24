import { supabase } from '../client'

export interface BuyerPreferences {
  user_id: string
  preferred_wine_types: string[]
  preferred_appellations: string[]
  monthly_budget_min: number | null
  monthly_budget_max: number | null
}

export const getBuyerPreferences = async (userId: string): Promise<BuyerPreferences | null> => {
  const { data, error } = await supabase
    .from('buyer_preferences')
    .select('user_id, preferred_wine_types, preferred_appellations, monthly_budget_min, monthly_budget_max')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export const upsertBuyerPreferences = async (prefs: BuyerPreferences): Promise<void> => {
  const { error } = await supabase
    .from('buyer_preferences')
    .upsert({ ...prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  if (error) throw error
}
