const configuredUrl = import.meta.env?.VITE_WHATSAPP_API_URL || "";

function baseUrl() {
  const root = String(configuredUrl).trim().replace(/\/+$/, "");

  if (!root) {
    throw new Error("No se configuró la conexión de WhatsApp.");
  }

  return root;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error("WhatsApp respondió con un formato inesperado.");
  }
}

export async function getWhatsAppCsrfToken() {
  const response = await fetch(`${baseUrl()}/api/admin/csrf`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const json = await parseJson(response);

  if (!response.ok || json.success !== true) {
    throw new Error(json.message || "No fue posible iniciar la sesión de WhatsApp.");
  }

  return json.data?.csrf_token || "";
}

export async function loginWhatsAppAdmin(email, password) {
  const csrfToken = await getWhatsAppCsrfToken();
  const response = await fetch(`${baseUrl()}/api/admin/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-TOKEN": csrfToken } : {}),
    },
    body: JSON.stringify({ email, password }),
  });
  const json = await parseJson(response);

  if (!response.ok || json.success !== true) {
    throw new Error(json.message || "No fue posible autenticar WhatsApp Admin.");
  }

  return json.data;
}

export async function logoutWhatsAppAdmin() {
  try {
    const csrfToken = await getWhatsAppCsrfToken();
    await fetch(`${baseUrl()}/api/admin/logout`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(csrfToken ? { "X-CSRF-TOKEN": csrfToken } : {}),
      },
    });
  } catch {
    // Supabase remains the primary admin session for the app shell.
  }
}
