import { supabase } from '@/supabase'

export const getRoutes = async () => {
  const { data, error } = await supabase
    .from('quote_routes')
    .select(`
      *,
      from_airport:airports!quote_routes_from_airport_fkey(ciudad),
      to_airport:airports!quote_routes_to_airport_fkey(ciudad)
    `)

  if (error) throw error
  return data
}
