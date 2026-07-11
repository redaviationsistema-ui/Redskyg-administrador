export const DEFAULT_BULK_EMAIL_SUBJECT = "Sky Group | Aircraft Parts Available";
export const DEFAULT_BULK_EMAIL_TITLE = "Aircraft Parts Available";
export const DEFAULT_BULK_EMAIL_BUTTON_TEXT = "Request a Quotation";
export const DEFAULT_BULK_EMAIL_BUTTON_URL = "mailto:Sales@redskyg.com";
export const DEFAULT_BULK_EMAIL_SENDER_NAME = "Sky Group";
export const DEFAULT_BULK_EMAIL_SENDER_EMAIL = "Sales@redskyg.com";
export const DEFAULT_BULK_EMAIL_REPLY_TO = "Sales@redskyg.com";
export const DEFAULT_BULK_EMAIL_CONTENT_HTML = `
  <p>
    Sky Group specializes in aircraft parts, components, avionics,
    rotables and aviation equipment.
  </p>
  <p>
    Please send us your part number, description, quantity,
    required condition and certification requirements.
  </p>
  <p>
    Our sales team will provide availability, lead time,
    certification and pricing.
  </p>
`.trim();

export const DEFAULT_BULK_EMAIL_CONTENT_TEXT =
  "Sky Group specializes in aircraft parts, components, avionics, rotables and aviation equipment.\n\n" +
  "Please send us your part number, description, quantity, required condition and certification requirements.\n\n" +
  "Our sales team will provide availability, lead time, certification and pricing.";

export function getDefaultBulkEmailDraft() {
  return {
    subject: DEFAULT_BULK_EMAIL_SUBJECT,
    status: "draft",
    sender_name: DEFAULT_BULK_EMAIL_SENDER_NAME,
    sender_email: DEFAULT_BULK_EMAIL_SENDER_EMAIL,
    reply_to: DEFAULT_BULK_EMAIL_REPLY_TO,
    main_title: DEFAULT_BULK_EMAIL_TITLE,
    content_html: DEFAULT_BULK_EMAIL_CONTENT_HTML,
    content_text: DEFAULT_BULK_EMAIL_CONTENT_TEXT,
    button_text: DEFAULT_BULK_EMAIL_BUTTON_TEXT,
    button_url: DEFAULT_BULK_EMAIL_BUTTON_URL,
    image_url: "",
    image_path: "",
  };
}

export function buildBulkEmailApiPayload(values = {}) {
  const subject = String(values.subject || DEFAULT_BULK_EMAIL_SUBJECT).trim();
  const title = String(values.main_title || subject || DEFAULT_BULK_EMAIL_TITLE).trim();
  const content = String(values.content_html || values.content_text || DEFAULT_BULK_EMAIL_CONTENT_HTML).trim();
  const buttonText = String(values.button_text || DEFAULT_BULK_EMAIL_BUTTON_TEXT).trim();
  const buttonUrl = String(values.button_url || DEFAULT_BULK_EMAIL_BUTTON_URL).trim();
  const imageUrl = String(values.image_url || values.image_preview_url || "").trim();

  return {
    subject,
    title,
    content,
    button_text: buttonText,
    button_url: buttonUrl,
    image_url: imageUrl,
    sender_name: String(values.sender_name || DEFAULT_BULK_EMAIL_SENDER_NAME).trim(),
    sender_email: String(values.sender_email || DEFAULT_BULK_EMAIL_SENDER_EMAIL).trim(),
    reply_to: String(values.reply_to || DEFAULT_BULK_EMAIL_REPLY_TO).trim(),
  };
}
