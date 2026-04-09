import { supabase } from '../client'

export interface MacroArea {
  id: string
  name: string
  slug: string
  description: string | null
  display_order: number
  metadata: Record<string, unknown> | null
}

let cachedAreas: MacroArea[] | null = null

export const getMacroAreas = async (): Promise<MacroArea[]> => {
  if (cachedAreas) return cachedAreas

  const { data, error } = await supabase
    .from('macro_areas')
    .select('id, name, slug, description, display_order, metadata')
    .eq('is_active', true)
    .order('display_order')

  if (error) throw error
  cachedAreas = data ?? []
  return cachedAreas
}

export const invalidateMacroAreasCache = () => {
  cachedAreas = null
}
