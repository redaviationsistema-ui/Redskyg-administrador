import { supabase } from '@/supabase'

export const getAirports = async () => {
  const { data, error } = await supabase
    .from('aeropuertos_mexico')
    .select('*')
    .order('ciudad')

  if (error) throw error
  return data
}

export const createAirport = async (payload) => {
  const { data, error } = await supabase
    .from('aeropuertos_mexico')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateAirport = async (id, payload) => {
  const { data, error } = await supabase
    .from('aeropuertos_mexico')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
