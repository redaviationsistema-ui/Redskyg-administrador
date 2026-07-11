function parseFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildMutableStatsFields(values = {}, { isNew = false } = {}) {
  const fields = {};

  if (isNew) {
    fields.total_recipients = parseFiniteNumber(values.total_recipients) ?? 0;
    fields.sent_count = parseFiniteNumber(values.sent_count) ?? 0;
    fields.failed_count = parseFiniteNumber(values.failed_count) ?? 0;
    return fields;
  }

  const totalRecipients = parseFiniteNumber(values.total_recipients);
  const sentCount = parseFiniteNumber(values.sent_count);
  const failedCount = parseFiniteNumber(values.failed_count);

  if (totalRecipients !== null) {
    fields.total_recipients = totalRecipients;
  }
  if (sentCount !== null) {
    fields.sent_count = sentCount;
  }
  if (failedCount !== null) {
    fields.failed_count = failedCount;
  }

  return fields;
}

export function deriveCampaignSummaryMetrics(campaign = {}, { recipientTotal = 0, progress = null } = {}) {
  const campaignTotal = parseFiniteNumber(campaign.total_recipients) ?? 0;
  const derivedTotal = Math.max(campaignTotal, parseFiniteNumber(recipientTotal) ?? 0);
  const sentCount = Math.max(
    parseFiniteNumber(campaign.sent_count) ?? 0,
    parseFiniteNumber(progress?.sent) ?? 0,
    parseFiniteNumber(progress?.sent_count) ?? 0,
  );
  const failedCount = Math.max(
    parseFiniteNumber(campaign.failed_count) ?? 0,
    parseFiniteNumber(progress?.failed) ?? 0,
    parseFiniteNumber(progress?.failed_count) ?? 0,
  );

  return {
    totalRecipients: derivedTotal,
    sentCount,
    failedCount,
    pendingCount: Math.max(derivedTotal - sentCount - failedCount, 0),
  };
}
