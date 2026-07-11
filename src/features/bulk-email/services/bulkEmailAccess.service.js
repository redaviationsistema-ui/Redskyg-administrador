import { supabaseInventory } from "@/supabase";

function extractRoleValues(user) {
  const appRole = user?.app_metadata?.role;
  const appRoles = user?.app_metadata?.roles;
  const userRole = user?.user_metadata?.role;
  const userRoles = user?.user_metadata?.roles;

  return [
    ...(Array.isArray(appRoles) ? appRoles : []),
    ...(Array.isArray(userRoles) ? userRoles : []),
    appRole,
    userRole,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}

export async function getBulkEmailAccessStatus() {
  const {
    data: { session },
    error,
  } = await supabaseInventory.auth.getSession();

  const user = session?.user || null;
  const roles = extractRoleValues(user);
  const hasAdminRole = roles.includes("admin") || roles.includes("administrator");

  return {
    hasInventorySession: Boolean(session?.access_token),
    inventorySessionError: error?.message || "",
    inventoryUserEmail: user?.email || "",
    roles,
    hasAdminRole,
    canCallPhpApi: Boolean(session?.access_token),
    canAttemptStorageUpload: Boolean(session?.access_token),
    warnings: [
      ...(session?.access_token ? [] : ["No hay sesión activa en Supabase Inventory."]),
      ...(session?.access_token && !roles.length
        ? ["El JWT de Inventory no expone roles; si el bucket exige admin, Storage seguirá rechazando uploads."]
        : []),
    ],
  };
}
