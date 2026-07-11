import { supabaseInventory } from "@/supabase";
import { buildUrlEncodedBody, normalizeSendTestPayload } from "../utils/bulkEmailApiPayload";

const RAW_API_URL = import.meta.env.VITE_BULK_EMAIL_API_URL;
const RAW_SEND_TEST_URL = import.meta.env.VITE_BULK_EMAIL_SEND_TEST_URL || "https://redskyg.com/administrador/bulk_email_send.php";

export function isBulkEmailLocalProxyMode() {
  return typeof window !== "undefined" && /localhost|127\.0\.0\.1/i.test(window.location.hostname);
}

export function resolveBulkEmailApiUrl() {
  if (!RAW_API_URL) {
    return "";
  }

  if (isBulkEmailLocalProxyMode()) {
    return "/bulk-email-api";
  }

  return RAW_API_URL;
}

function resolveBulkEmailSendTestUrl() {
  if (!RAW_SEND_TEST_URL) {
    return "";
  }

  if (isBulkEmailLocalProxyMode()) {
    return "/bulk-email-send-api";
  }

  return RAW_SEND_TEST_URL;
}

function buildApiErrorMessage(error) {
  const message = String(error?.message || "");

  if (message === "Failed to fetch" || /cors|access-control-allow-origin|preflight|networkerror/i.test(message)) {
    return isBulkEmailLocalProxyMode()
      ? "No fue posible conectar con la API de correos masivos. En local usa el proxy de Vite; reinicia `npm run dev` para que tome `/bulk-email-api`."
      : "No fue posible conectar con la API de correos masivos. Verifica CORS, red o disponibilidad del endpoint.";
  }

  return message || "No se pudo completar la operación.";
}

export function getBulkEmailApiDiagnosticMessage() {
  if (!RAW_API_URL) {
    return "Falta `VITE_BULK_EMAIL_API_URL` en el entorno."
  }

  if (isBulkEmailLocalProxyMode()) {
    return "Modo local detectado: la app llamará `/bulk-email-api` por proxy de Vite para evitar CORS."
  }

  return `API remota configurada: ${RAW_API_URL}`
}

function shouldRetrySendTestAsForm(response, responseText) {
  if (!response) {
    return false;
  }

  if (response.ok) {
    return false;
  }

  const text = String(responseText || "").trim();
  return response.status >= 500 || text === "";
}

async function parseJsonResponseOrThrow(responseText) {
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`El servidor no respondió con JSON. Respuesta: ${responseText}`);
  }
}

function shouldRetryAsJson(response, responseText) {
  if (!response) {
    return false;
  }

  const text = String(responseText || "").trim().toLowerCase();
  return !response.ok || text === "" || text.includes("no respondió con json");
}

async function callBulkEmailApi(action, payload = {}) {
  const apiUrl = resolveBulkEmailApiUrl();

  if (!apiUrl) {
    throw new Error("No existe VITE_BULK_EMAIL_API_URL en el entorno.");
  }

  const {
    data: { session },
    error,
  } = await supabaseInventory.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.access_token) {
    throw new Error("No existe una sesión activa en Supabase Inventory.");
  }

  const requestPayload = {
    action,
    ...payload,
  };
  let response;
  let responseText = "";

  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: buildUrlEncodedBody(requestPayload),
    });
  } catch (error) {
    throw new Error(buildApiErrorMessage(error));
  }

  responseText = await response.text();

  if (shouldRetryAsJson(response, responseText)) {
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestPayload),
      });
    } catch (error) {
      throw new Error(buildApiErrorMessage(error));
    }

    responseText = await response.text();
  }

  let result = null;

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      result = null;
    }
  }

  if (!response.ok || result?.success === false) {
    throw new Error(result?.error || result?.message || `La API respondió con estado ${response.status}.`);
  }

  return result;
}

export async function sendTestCampaign(campaignId, email, payload = {}) {
  const apiUrl = resolveBulkEmailSendTestUrl();

  if (!apiUrl) {
    throw new Error("No existe un endpoint configurado para enviar correos de prueba.");
  }

  const requestPayload = normalizeSendTestPayload(campaignId, email, payload);
  let response;
  let responseText = "";

  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json",
      },
      body: buildUrlEncodedBody(requestPayload),
    });
  } catch (error) {
    throw new Error(buildApiErrorMessage(error));
  }

  responseText = await response.text();

  if (shouldRetrySendTestAsForm(response, responseText)) {
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
    } catch (error) {
      throw new Error(buildApiErrorMessage(error));
    }

    responseText = await response.text();
  }

  const result = await parseJsonResponseOrThrow(responseText);

  if (!response.ok || result?.success !== true) {
    throw new Error(result?.message || `No se pudo enviar el correo. Estado HTTP ${response.status}`);
  }

  return result;
}

export function startCampaign(campaignId, payload = {}) {
  return callBulkEmailApi("start_campaign", {
    campaign_id: campaignId,
    ...payload,
  });
}

export function processCampaign(campaignId) {
  return callBulkEmailApi("process_campaign", {
    campaign_id: campaignId,
  });
}

export async function startAndProcessCampaign(campaignId, payload = {}) {
  const startResult = await startCampaign(campaignId, payload);
  const processResult = await processCampaign(campaignId);

  return {
    success: true,
    start: startResult,
    process: processResult,
  };
}

export function pauseCampaign(campaignId) {
  return callBulkEmailApi("pause_campaign", {
    campaign_id: campaignId,
  });
}

export function resumeCampaign(campaignId) {
  return callBulkEmailApi("resume_campaign", {
    campaign_id: campaignId,
  });
}

export function cancelCampaign(campaignId) {
  return callBulkEmailApi("cancel_campaign", {
    campaign_id: campaignId,
  });
}

export function getCampaignProgress(campaignId) {
  return callBulkEmailApi("get_progress", {
    campaign_id: campaignId,
  });
}
