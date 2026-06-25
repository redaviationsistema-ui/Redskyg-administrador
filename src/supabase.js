import { createClient } from '@supabase/supabase-js'

// BD PRINCIPAL
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// BD INVENTARIO
export const supabaseInventory = createClient(
  import.meta.env.VITE_SUPABASE_URL2,
  import.meta.env.VITE_SUPABASE_ANON_KEY2
)