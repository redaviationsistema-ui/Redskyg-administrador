const normalizeRole = (value) => String(value || "").trim().toLowerCase();

export function getResponseTemplateAccess(user) {
  const roles = [
    ...(Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : []),
    ...(Array.isArray(user?.user_metadata?.roles) ? user.user_metadata.roles : []),
    user?.app_metadata?.role,
    user?.user_metadata?.role,
  ].filter(Boolean).map(normalizeRole);
  const role = roles.find((item) => ["admin", "administrator", "supervisor", "advisor", "asesor"].includes(item));
  // El administrador actual permite navegar sus módulos sin una sesión obligatoria.
  // En ese modo local se conserva acceso completo para que esta pestaña siga el mismo patrón.
  const isLocalAdmin = !user;
  const isAdmin = role === "admin" || role === "administrator" || isLocalAdmin;
  const isSupervisor = role === "supervisor";
  const isAdvisor = role === "advisor" || role === "asesor";
  return {
    role: isAdmin ? "admin" : isSupervisor ? "supervisor" : isAdvisor ? "advisor" : "none",
    canView: isAdmin || isSupervisor || isAdvisor,
    canUse: isAdmin || isSupervisor || isAdvisor,
    canCreate: isAdmin || isSupervisor,
    canEdit: isAdmin || isSupervisor,
    canDuplicate: isAdmin || isSupervisor,
    canToggle: isAdmin,
    canDelete: isAdmin,
  };
}
