import { getWhatsAppCsrfToken } from "@/services/whatsappAdminSession.service";

const configuredUrl = import.meta.env?.VITE_WHATSAPP_API_URL || "";

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

export function createWhatsAppApi(baseUrl, fetcher = (...args) => fetch(...args)) {
  const root = String(baseUrl).trim().replace(/\/+$/, "");

  async function request(resource, path = "", { method = "GET", body, signal, ...params } = {}) {
    if (!root) {
      throw new Error("No se configuró la conexión de WhatsApp.");
    }

    const query = new URLSearchParams(cleanParams(params));
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
    }

    const timeout = setTimeout(abort, 60000);

    try {
      const csrfToken = method === "GET" ? "" : await getWhatsAppCsrfToken();
      const response = await fetcher(`${root}/api/admin/whatsapp/${resource}${path}${query.size ? `?${query}` : ""}`, {
        method,
        credentials: "include",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(csrfToken ? { "X-CSRF-TOKEN": csrfToken } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      let json;
      try {
        json = await response.json();
      } catch {
        throw new Error("WhatsApp respondió con un formato inesperado.");
      }

      if (!response.ok || json.success !== true) {
        const fallback = {
          401: "Tu sesión no tiene acceso al módulo de WhatsApp.",
          403: "No tienes permisos para esta operación.",
          404: "No se encontró el recurso solicitado.",
          422: "Revisa los filtros o datos enviados.",
          429: "Demasiadas solicitudes. Espera un momento antes de actualizar.",
          500: "El servidor no pudo completar la operación.",
        };
        throw new Error(json.message || fallback[response.status] || "No fue posible completar la operación.");
      }

      if (!("data" in json)) {
        throw new Error("La respuesta de WhatsApp no contiene datos.");
      }

      return json;
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new Error("La conexión tardó demasiado. Actualiza para comprobar el resultado antes de reenviar.");
      }
      if (error instanceof TypeError) {
        throw new Error("No fue posible conectar con WhatsApp. Revisa la conexión o inténtalo más tarde.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }

  const idPath = (id) => `/${encodeURIComponent(String(id))}`;
  const statusBody = (status) => ({ status });

  return {
    getDashboard: (options = {}) => request("dashboard", "", options),
    getHistory: (options = {}) => request("history", "", options),

    getConversations: (options = {}) => request("conversations", "", options),
    getConversation: (id, options = {}) => request("conversations", idPath(id), options),
    getMessages: (id, options = {}) => request("conversations", `${idPath(id)}/messages`, options),
    transferToHuman: (id) => request("conversations", `${idPath(id)}/transfer-to-human`, { method: "POST" }),
    takeoverConversation: (id) => request("conversations", `${idPath(id)}/takeover`, { method: "POST" }),
    returnToBot: (id) => request("conversations", `${idPath(id)}/return-to-bot`, { method: "POST" }),

    getFlightRequests: (options = {}) => request("flight-requests", "", options),
    getFlightRequest: (id, options = {}) => request("flight-requests", idPath(id), options),

    getParts: (options = {}) => request("parts", "", options),
    getPart: (id, options = {}) => request("parts", idPath(id), options),
    updatePartStatus: (id, status) => request("parts", `${idPath(id)}/status`, { method: "PATCH", body: statusBody(status) }),

    getEngines: (options = {}) => request("engines", "", options),
    getEngine: (id, options = {}) => request("engines", idPath(id), options),
    updateEngineStatus: (id, status) => request("engines", `${idPath(id)}/status`, { method: "PATCH", body: statusBody(status) }),

    getSupport: (options = {}) => request("support", "", options),
    getSupportRequest: (id, options = {}) => request("support", idPath(id), options),
    updateSupportStatus: (id, status) => request("support", `${idPath(id)}/status`, { method: "PATCH", body: statusBody(status) }),

    getAdvisorRequests: (options = {}) => request("advisor-requests", "", options),
    getAdvisorRequest: (id, options = {}) => request("advisor-requests", idPath(id), options),
    updateAdvisorStatus: (id, status) => request("advisor-requests", `${idPath(id)}/status`, { method: "PATCH", body: statusBody(status) }),
  };
}

export const {
  getDashboard,
  getHistory,
  getConversations,
  getConversation,
  getMessages,
  transferToHuman,
  takeoverConversation,
  returnToBot,
  getFlightRequests,
  getFlightRequest,
  getParts,
  getPart,
  updatePartStatus,
  getEngines,
  getEngine,
  updateEngineStatus,
  getSupport,
  getSupportRequest,
  updateSupportStatus,
  getAdvisorRequests,
  getAdvisorRequest,
  updateAdvisorStatus,
} = createWhatsAppApi(configuredUrl);
