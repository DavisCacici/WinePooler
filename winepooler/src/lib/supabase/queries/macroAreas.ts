import { supabase } from '../client'

export interface MacroArea {
  id: string
  name: string
  slug: string
  description: string | null
  display_order: number
}

export const getMacroAreas = async (): Promise<MacroArea[]> => {
  const { data, error } = await supabase
    .from('macro_areas')
    .select('id, name, slug, description, display_order')
    .eq('is_active', true)
    .order('display_order')

  if (error) throw error
  return data ?? []
}
