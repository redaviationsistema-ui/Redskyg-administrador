import { supabaseInventory } from "@/supabase";
import { getCampaignImageUrl } from "./bulkEmailStorage.service";
import { normalizeEmail } from "../utils/emailValidator";
import { buildMutableStatsFields } from "../utils/bulkEmailCampaignState";

const CAMPAIGN_COLUMNS = [
  "id",
  "subject",
  "status",
  "sender_name",
  "sender_email",
  "reply_to",
  "image_url",
  "image_path",
  "total_recipients",
  "sent_count",
  "failed_count",
  "started_at",
  "completed_at",
  "created_at",
  "updated_at",
].join(",");

const RECIPIENT_COLUMNS = ["id", "campaign_id", "email", "name", "domain", "created_at"].join(",");
const DELIVERY_COLUMNS = [
  "id",
  "campaign_id",
  "recipient_id",
  "status",
  "sent_at",
  "delivered_at",
  "opened_at",
  "clicked_at",
  "error_message",
  "provider_message_id",
  "created_at",
  "updated_at",
].join(",");
const UNSUBSCRIBE_COLUMNS = ["id", "email", "reason", "unsubscribed_at"].join(",");

const PROCESSING_STATUSES = new Set(["processing", "in_progress", "sending", "running"]);
const COMPLETED_STATUSES = new Set(["completed", "sent", "finished"]);
const DRAFT_STATUSES = new Set(["draft", "borrador"]);
const SCHEDULED_STATUSES = new Set(["scheduled", "programada", "queued"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled"]);
const OPTIONAL_MUTATION_COLUMNS = new Set(["image_name", "image_url", "image_path"]);

function deriveImageName(values = {}) {
  const explicitName = String(values.image_name || "").trim();
  if (explicitName) {
    return explicitName;
  }

  const source = String(values.image_path || values.image_url || "").trim();
  if (!source) {
    return "";
  }

  const normalized = source.split("?")[0].split("#")[0];
  const segments = normalized.split("/");
  return String(segments[segments.length - 1] || "").trim();
}

async function getInventoryActorId() {
  const {
    data: { session },
    error,
  } = await supabaseInventory.auth.getSession();

  if (error) {
    throw error;
  }

  const actorId = session?.user?.id || "";
  if (!actorId) {
    throw new Error("No existe una sesión activa de Inventory para completar `created_by`.");
  }

  return actorId;
}

async function mapCampaign(record) {
  const totalRecipients = Number(record.total_recipients || 0);
  const sentCount = Number(record.sent_count || 0);
  const failedCount = Number(record.failed_count || 0);
  let imagePreviewUrl = "";

  try {
    imagePreviewUrl = await getCampaignImageUrl(record.image_path || record.image_url || "");
  } catch {
    imagePreviewUrl = record.image_url || "";
  }

  return {
    ...record,
    image_preview_url: imagePreviewUrl,
    internal_name: record.subject || `Campaña #${record.id}`,
    pending_count: Math.max(totalRecipients - sentCount - failedCount, 0),
  };
}

function countStatuses(items = []) {
  return items.reduce(
    (accumulator, item) => {
      const status = String(item.status || "").toLowerCase();

      accumulator.total += 1;
      if (DRAFT_STATUSES.has(status)) {
        accumulator.drafts += 1;
      }
      if (SCHEDULED_STATUSES.has(status)) {
        accumulator.scheduled += 1;
      }
      if (PROCESSING_STATUSES.has(status)) {
        accumulator.processing += 1;
      }
      if (COMPLETED_STATUSES.has(status)) {
        accumulator.completed += 1;
      }
      return accumulator;
    },
    {
      total: 0,
      drafts: 0,
      scheduled: 0,
      processing: 0,
      completed: 0,
    },
  );
}

async function buildCampaignMutationPayload(values = {}, { isNew = false } = {}) {
  const actorId = await getInventoryActorId();

  return {
    subject: values.subject || "",
    status: values.status || "draft",
    sender_name: values.sender_name || "",
    sender_email: values.sender_email || "",
    reply_to: values.reply_to || "",
    image_name: deriveImageName(values),
    image_url: values.image_url || "",
    image_path: values.image_path || "",
    ...buildMutableStatsFields(values, { isNew }),
    ...(isNew ? { created_by: actorId } : {}),
  };
}

function extractMissingColumnName(error) {
  const message = String(error?.message || "");
  const match = message.match(/could not find the ['"]([^'"]+)['"] column/i);
  return match?.[1] || "";
}

function sanitizeCampaignPayloadForRetry(payload, error) {
  const missingColumn = extractMissingColumnName(error);
  if (!missingColumn || !OPTIONAL_MUTATION_COLUMNS.has(missingColumn) || !(missingColumn in payload)) {
    return null;
  }

  const retryPayload = { ...payload };
  delete retryPayload[missingColumn];
  return retryPayload;
}

async function insertCampaignWithFallback(payload) {
  let query = supabaseInventory
    .from("bulk_email_campaigns")
    .insert(payload)
    .select(CAMPAIGN_COLUMNS)
    .single();

  let { data, error } = await query;

  if (error) {
    const retryPayload = sanitizeCampaignPayloadForRetry(payload, error);
    if (!retryPayload) {
      throw error;
    }

    ({ data, error } = await supabaseInventory
      .from("bulk_email_campaigns")
      .insert(retryPayload)
      .select(CAMPAIGN_COLUMNS)
      .single());
  }

  if (error) {
    throw error;
  }

  return data;
}

async function updateCampaignWithFallback(id, payload) {
  let { data, error } = await supabaseInventory
    .from("bulk_email_campaigns")
    .update(payload)
    .eq("id", id)
    .select(CAMPAIGN_COLUMNS)
    .single();

  if (error) {
    const retryPayload = sanitizeCampaignPayloadForRetry(payload, error);
    if (!retryPayload) {
      throw error;
    }

    ({ data, error } = await supabaseInventory
      .from("bulk_email_campaigns")
      .update(retryPayload)
      .eq("id", id)
      .select(CAMPAIGN_COLUMNS)
      .single());
  }

  if (error) {
    throw error;
  }

  return data;
}

export async function syncCampaignRecipientCount(campaignId) {
  const { count, error } = await supabaseInventory
    .from("bulk_email_recipients")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if (error) {
    throw error;
  }

  const { error: campaignError } = await supabaseInventory
    .from("bulk_email_campaigns")
    .update({ total_recipients: count || 0 })
    .eq("id", campaignId);

  if (campaignError) {
    throw campaignError;
  }
}

export async function getCampaigns({
  page = 1,
  pageSize = 10,
  search = "",
  status = "all",
  startDate = "",
  endDate = "",
} = {}) {
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = supabaseInventory.from("bulk_email_campaigns").select(CAMPAIGN_COLUMNS, { count: "exact" });
  const term = String(search || "").trim();

  if (term) {
    query = query.or(`subject.ilike.%${term}%,sender_name.ilike.%${term}%`);
  }

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (startDate) {
    query = query.gte("created_at", `${startDate}T00:00:00`);
  }

  if (endDate) {
    query = query.lte("created_at", `${endDate}T23:59:59`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return {
    rows: await Promise.all((data || []).map(mapCampaign)),
    total: count || 0,
  };
}

export async function getCampaignStats() {
  const [{ data: campaigns, error: campaignsError }, { data: deliveries, error: deliveriesError }, { count: unsubscribedCount, error: unsubscribesError }] =
    await Promise.all([
      supabaseInventory.from("bulk_email_campaigns").select(CAMPAIGN_COLUMNS),
      supabaseInventory.from("bulk_email_deliveries").select(DELIVERY_COLUMNS),
      supabaseInventory.from("bulk_email_unsubscribes").select("*", { count: "exact", head: true }),
    ]);

  if (campaignsError) {
    throw campaignsError;
  }

  const statusCounts = countStatuses(campaigns || []);
  const sent = (campaigns || []).reduce((sum, item) => sum + Number(item.sent_count || 0), 0);
  const failed = (campaigns || []).reduce((sum, item) => sum + Number(item.failed_count || 0), 0);
  const cancellations =
    (!unsubscribesError ? unsubscribedCount : 0) ||
    (!deliveriesError ? (deliveries || []).filter((item) => CANCELLED_STATUSES.has(String(item.status || "").toLowerCase())).length : 0);

  return {
    totalCampaigns: statusCounts.total,
    drafts: statusCounts.drafts,
    scheduled: statusCounts.scheduled,
    processing: statusCounts.processing,
    completed: statusCounts.completed,
    sent,
    failed,
    cancellations,
  };
}

export async function getCampaignById(id) {
  const { data, error } = await supabaseInventory
    .from("bulk_email_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return await mapCampaign(data);
}

export async function createCampaign(values) {
  const payload = await buildCampaignMutationPayload(values, { isNew: true });
  const data = await insertCampaignWithFallback(payload);
  return await mapCampaign(data);
}

export async function updateCampaign(id, values) {
  const payload = await buildCampaignMutationPayload(values);
  const data = await updateCampaignWithFallback(id, payload);
  return await mapCampaign(data);
}

export async function deleteCampaign(id) {
  const { error } = await supabaseInventory.from("bulk_email_campaigns").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function duplicateCampaign(id) {
  const campaign = await getCampaignById(id);
  return createCampaign({
    ...campaign,
    subject: `${campaign.subject} (Copia)`,
    status: "draft",
    sent_count: 0,
    failed_count: 0,
  });
}

export async function getCampaignRecipients({ campaignId, page = 1, pageSize = 10 }) {
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  const { data, error, count } = await supabaseInventory
    .from("bulk_email_recipients")
    .select(RECIPIENT_COLUMNS, { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return {
    rows: data || [],
    total: count || 0,
  };
}

export async function ensureCampaignRecipientCount(campaignId) {
  await syncCampaignRecipientCount(campaignId);
  return getCampaignById(campaignId);
}

export async function addCampaignRecipients(campaignId, recipients = []) {
  const payload = recipients.map((item) => ({
    campaign_id: campaignId,
    email: normalizeEmail(item.email),
    normalized_email: normalizeEmail(item.email),
    name: item.name || "",
    domain: item.domain || "",
  }));

  if (!payload.length) {
    return [];
  }

  const { data, error } = await supabaseInventory
    .from("bulk_email_recipients")
    .insert(payload)
    .select(RECIPIENT_COLUMNS);

  if (error) {
    throw error;
  }

  await syncCampaignRecipientCount(campaignId);

  return data || [];
}

export async function removeCampaignRecipient(id) {
  const { data: recipient, error: fetchError } = await supabaseInventory
    .from("bulk_email_recipients")
    .select("campaign_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  const { error } = await supabaseInventory.from("bulk_email_recipients").delete().eq("id", id);
  if (error) {
    throw error;
  }

  if (recipient?.campaign_id) {
    await syncCampaignRecipientCount(recipient.campaign_id);
  }
}

export async function getCampaignDeliveries({ campaignId, page = 1, pageSize = 10 }) {
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  const { data, error, count } = await supabaseInventory
    .from("bulk_email_deliveries")
    .select(DELIVERY_COLUMNS, { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return {
    rows: data || [],
    total: count || 0,
  };
}

export async function getUnsubscribes() {
  const { data, error } = await supabaseInventory
    .from("bulk_email_unsubscribes")
    .select(UNSUBSCRIBE_COLUMNS)
    .order("unsubscribed_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function checkUnsubscribedEmails(emails = []) {
  const normalized = [...new Set(emails.map((value) => normalizeEmail(value)).filter(Boolean))];
  if (!normalized.length) {
    return [];
  }

  const { data, error } = await supabaseInventory
    .from("bulk_email_unsubscribes")
    .select(UNSUBSCRIBE_COLUMNS)
    .in("email", normalized);

  if (error) {
    return [];
  }

  return data || [];
}

export function getProcessingStatuses() {
  return [...PROCESSING_STATUSES];
}
