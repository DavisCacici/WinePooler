export interface MacroArea {
  id: string
  name: string
  slug: string
  description: string | null
  display_order: number
  metadata: Record<string, unknown> | null
}