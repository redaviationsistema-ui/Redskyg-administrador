import { supabase, supabaseInventory } from '@/supabase'

function normalizeAuthError(error, source = 'main') {
  if (!error) {
    return new Error('No fue posible autenticar la sesión.')
  }

  const code = String(error.code || error.name || '').toLowerCase()
  const message = String(error.message || '')

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return new Error(
      source === 'inventory'
        ? 'Las credenciales de Inventory no coinciden. Usa el acceso separado para Correos Masivos.'
        : 'Las credenciales del administrador no son válidas.',
    )
  }

  return error instanceof Error ? error : new Error(message || 'No fue posible autenticar la sesión.')
}

export const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw normalizeAuthError(error, 'main')
  return data.user
}

export const loginInventory = async (email, password) => {
  const { data, error } = await supabaseInventory.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw normalizeAuthError(error, 'inventory')
  return data.user
}

export const logout = async () => {
  await Promise.allSettled([
    supabase.auth.signOut(),
    supabaseInventory.auth.signOut(),
  ])
}

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    return null
  }

  return data.user || null
}

export const getInventoryCurrentUser = async () => {
  const { data, error } = await supabaseInventory.auth.getUser()

  if (error) {
    return null
  }

  return data.user || null
}

export const getInventorySessionInfo = async () => {
  const { data, error } = await supabaseInventory.auth.getSession()

  if (error) {
    return {
      session: null,
      error,
      user: null,
    }
  }

  return {
    session: data.session || null,
    error: null,
    user: data.session?.user || null,
  }
}

export const getSession = async () => {
  return await getCurrentUser()
}

export const hasAdminAccess = (user) => {
  if (!user) {
    return false
  }

  const appRole = user.app_metadata?.role
  const appRoles = user.app_metadata?.roles
  const userRole = user.user_metadata?.role
  const userRoles = user.user_metadata?.roles

  const roleValues = [
    ...(Array.isArray(appRoles) ? appRoles : []),
    ...(Array.isArray(userRoles) ? userRoles : []),
    appRole,
    userRole,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())

  if (!roleValues.length) {
    return true
  }

  return roleValues.includes('admin') || roleValues.includes('administrator')
}
