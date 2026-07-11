import { supabase } from '@/supabase'

export const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error
  return data.user
}

export const logout = async () => {
  await supabase.auth.signOut()
}

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    return null
  }

  return data.user || null
}

export const getSession = async () => {
  return await getCurrentUser()
}
