const configuredUrl = import.meta.env?.VITE_WHATSAPP_API_URL || "";

export function createWhatsAppApi(baseUrl, fetcher = (...args) => fetch(...args)) {
  const root = String(baseUrl).trim().replace(/\/+$/, "");
  async function request(path = "", { method = "GET", body, signal, ...params } = {}) {
    if (!root) throw new Error("No se configuró la conexión de WhatsApp.");
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null));
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timeout = setTimeout(abort, 60000);
    try {
      const response = await fetcher(`${root}/api/admin/whatsapp/conversations${path}${query.size ? `?${query}` : ""}`, {
        method, credentials: "omit", signal: controller.signal,
        headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      let json;
      try { json = await response.json(); } catch { throw new Error("WhatsApp respondió con un formato inesperado."); }
      if (!response.ok || json.success !== true) {
        throw new Error(response.status === 429 ? "Demasiadas solicitudes. Espera un momento antes de actualizar." : json.message || "No fue posible completar la operación.");
      }
      if (!("data" in json)) throw new Error("La respuesta de WhatsApp no contiene datos.");
      return json;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (controller.signal.aborted) throw new Error("La conexión tardó demasiado. Actualiza para comprobar el resultado antes de reenviar.");
      if (error instanceof TypeError) throw new Error("No fue posible conectar con WhatsApp. Revisa la conexión o inténtalo más tarde.");
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
  const idPath = (id) => `/${encodeURIComponent(String(id))}`;
  return {
    getConversations: (options = {}) => request("", options),
    getConversation: (id, options = {}) => request(idPath(id), options),
    getMessages: (id, options = {}) => request(`${idPath(id)}/messages`, options),
    sendMessage: (id, body) => request(`${idPath(id)}/messages`, { method: "POST", body: { body } }),
    takeoverConversation: (id) => request(`${idPath(id)}/takeover`, { method: "POST" }),
    returnToBot: (id) => request(`${idPath(id)}/return-to-bot`, { method: "POST" }),
  };
}

export const { getConversations, getConversation, getMessages, sendMessage, takeoverConversation, returnToBot } = createWhatsAppApi(configuredUrl);
