import { supabase } from './client'

export type AppRole = 'buyer' | 'winery'

export const normalizeRole = (role: unknown): AppRole | null => {
  if (typeof role !== 'string') {
    return null
  }

  const normalizedRole = role.trim().toLowerCase()

  if (normalizedRole === 'buyer' || normalizedRole === 'winery') {
    return normalizedRole
  }

  return null
}

export type RegisterData = {
  email: string
  password: string
  vatNumber: string
  role: AppRole
}

export const registerUser = async (data: RegisterData) => {
  const { email, password, vatNumber, role } = data

  // Sign up with Supabase
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        vat_number: vatNumber,
        role: role
      }
    }
  })

  if (authError) {
    throw authError
  }

  return authData
}

export const loginUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}