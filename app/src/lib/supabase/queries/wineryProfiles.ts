import { supabase } from '../client'

export interface WineryProfile {
  id: string
  user_id: string
  company_name: string
}

export const getWineryProfiles = async (): Promise<WineryProfile[]> => {
  const { data, error } = await supabase
    .from('winery_profiles')
    .select('id, user_id, company_name')
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