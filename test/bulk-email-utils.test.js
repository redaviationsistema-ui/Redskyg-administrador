import test from "node:test";
import assert from "node:assert/strict";
import { buildUrlEncodedBody, normalizeSendTestPayload } from "../src/features/bulk-email/utils/bulkEmailApiPayload.js";
import { buildMutableStatsFields, deriveCampaignSummaryMetrics } from "../src/features/bulk-email/utils/bulkEmailCampaignState.js";

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
  });

  assert.equal(payload.campaign_id, "abc");
  assert.equal(payload.email, "test@example.com");
  assert.equal(payload.subject, "Demo");
  assert.equal(payload.sender_email, "Sales@redskyg.com");
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
