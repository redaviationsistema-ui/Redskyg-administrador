import test from "node:test";
import assert from "node:assert/strict";
import { buildUrlEncodedBody, normalizeSendTestPayload } from "../src/features/bulk-email/utils/bulkEmailApiPayload.js";
import { buildMutableStatsFields, deriveCampaignSummaryMetrics } from "../src/features/bulk-email/utils/bulkEmailCampaignState.js";
import {
  BULK_EMAIL_ATTACHMENT_ACCEPT,
  UNSUPPORTED_FILE_MESSAGE,
  validateCampaignAttachment,
} from "../src/features/bulk-email/utils/bulkEmailAttachments.js";

test("buildUrlEncodedBody serializes booleans and strings safely", () => {
  const body = buildUrlEncodedBody({
    action: "send_test",
    campaign_id: "123",
    copy_internal: false,
    subject: "Demo",
  });

  assert.equal(body, "action=send_test&campaign_id=123&copy_internal=0&subject=Demo");
});

test("normalizeSendTestPayload trims key fields", () => {
  const payload = normalizeSendTestPayload("abc", " test@example.com ", {
    subject: " Demo ",
    sender_email: " Sales@redskyg.com ",
    attachment_url: " https://example.test/file.pdf ",
    attachment_mime_type: " application/pdf ",
  });

  assert.equal(payload.campaign_id, "abc");
  assert.equal(payload.email, "test@example.com");
  assert.equal(payload.subject, "Demo");
  assert.equal(payload.sender_email, "Sales@redskyg.com");
  assert.equal(payload.attachment_url, "https://example.test/file.pdf");
  assert.equal(payload.attachment_mime_type, "application/pdf");
});

test("normalizeSendTestPayload omits empty attachment fields", () => {
  const payload = normalizeSendTestPayload("abc", "test@example.com", {
    subject: "Demo",
  });

  assert.equal("attachment_url" in payload, false);
  assert.equal("attachment_name" in payload, false);
});

test("bulk email attachments accept images and PDF with matching MIME and extension", () => {
  assert.match(BULK_EMAIL_ATTACHMENT_ACCEPT, /application\/pdf/);
  assert.equal(validateCampaignAttachment({ name: "part.jpg", type: "image/jpeg", size: 1024 }), "");
  assert.equal(validateCampaignAttachment({ name: "part.pdf", type: "application/pdf", size: 1024 }), "");
  assert.equal(validateCampaignAttachment({ name: "part.pdf", type: "image/png", size: 1024 }), UNSUPPORTED_FILE_MESSAGE);
  assert.equal(validateCampaignAttachment({ name: "part.gif", type: "image/gif", size: 1024 }), UNSUPPORTED_FILE_MESSAGE);
});

test("bulk email attachments enforce the 10 MB file limit", () => {
  assert.equal(validateCampaignAttachment({ name: "part.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 }), "El archivo no puede exceder 10 MB.");
});

test("buildMutableStatsFields keeps zero defaults only for new campaigns", () => {
  assert.deepEqual(buildMutableStatsFields({}, { isNew: true }), {
    total_recipients: 0,
    sent_count: 0,
    failed_count: 0,
  });

  assert.deepEqual(buildMutableStatsFields({}, { isNew: false }), {});
});

test("buildMutableStatsFields preserves explicit counters on update", () => {
  assert.deepEqual(
    buildMutableStatsFields({ total_recipients: "4", sent_count: 1, failed_count: "2" }, { isNew: false }),
    {
      total_recipients: 4,
      sent_count: 1,
      failed_count: 2,
    },
  );
});

test("deriveCampaignSummaryMetrics prefers real recipient and progress totals", () => {
  const metrics = deriveCampaignSummaryMetrics(
    { total_recipients: 0, sent_count: 0, failed_count: 0 },
    {
      recipientTotal: 4,
      progress: {
        sent: 1,
        failed: 1,
      },
    },
  );

  assert.deepEqual(metrics, {
    totalRecipients: 4,
    sentCount: 1,
    failedCount: 1,
    pendingCount: 2,
  });
});
