export function normalizeSendTestPayload(campaignId, email, payload = {}) {
  const normalized = {
    action: "send_test",
    campaign_id: campaignId,
    email: String(email || "").trim(),
    subject: String(payload.subject || "").trim(),
    title: String(payload.title || payload.subject || "").trim(),
    content: String(payload.content || "").trim(),
    button_text: String(payload.button_text || "").trim(),
    button_url: String(payload.button_url || "").trim(),
    sender_name: String(payload.sender_name || "").trim(),
    sender_email: String(payload.sender_email || "").trim(),
    reply_to: String(payload.reply_to || "").trim(),
    image_url: String(payload.image_url || "").trim(),
    copy_internal: false,
  };

  const attachmentUrl = String(payload.attachment_url || "").trim();
  if (attachmentUrl) {
    normalized.attachment_url = attachmentUrl;
    normalized.attachment_name = String(payload.attachment_name || "").trim();
    normalized.attachment_mime_type = String(payload.attachment_mime_type || "").trim();
    normalized.attachment_size = String(payload.attachment_size || "").trim();
  }

  return normalized;
}

export function buildUrlEncodedBody(payload = {}) {
  const params = new URLSearchParams();

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    params.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  });

  return params.toString();
}
