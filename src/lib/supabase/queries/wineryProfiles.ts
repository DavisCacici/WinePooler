import { supabase } from '../client'

export interface WineryProfile {
  id?: string
  user_id: string
  company_name: string
  vat_number: string
  stripe_connect_account_id?: string | null
}

export const getWineryProfiles = async (): Promise<WineryProfile[]> => {
  const { data, error } = await supabase
    .from('winery_profiles')
    .select('id, user_id, company_name, vat_number, stripe_connect_account_id')
    .order('company_name')

  if (error) throw error
  return data ?? []
}


export const getWineryProfileByUserId = async (userId: string): Promise<WineryProfile | null> => {
   const { data, error } = await supabase
        .from('winery_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return data ?? null;
}

export const upsertWineryProfile = async (profile: WineryProfile) => {
  const { data, error } = await supabase
    .from('winery_profiles')
    .upsert(profile, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  return data
}