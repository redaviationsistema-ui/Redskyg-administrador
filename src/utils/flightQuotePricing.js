function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function roundMoney(value) {
  return Number(toNumber(value).toFixed(2));
}

export function roundExchangeRate(value) {
  return Number(toNumber(value).toFixed(4));
}

export function getBreakdownSubtotal(rows = []) {
  return roundMoney(rows.reduce((sum, row) => sum + toNumber(row?.value), 0));
}

function deriveMarginPercent(subtotalUsd, marginUsd) {
  if (subtotalUsd <= 0 || marginUsd <= 0) return 0;
  return Number(((marginUsd / subtotalUsd) * 100).toFixed(4));
}

export function resolveQuotePricing(quote, breakdownRows = []) {
  const snapshot = quote?.calculation_snapshot || {};
  const pdfTotals = snapshot?.pdfTotals || {};
  const pdfPricing = snapshot?.pdfPricing || {};
  const breakdownSubtotal = getBreakdownSubtotal(breakdownRows);
  const commercialSubtotalUsd = roundMoney(
    pdfPricing.commercialSubtotalUsd ??
      quote?.subtotal_usd ??
      pdfTotals.subtotal_usd ??
      breakdownSubtotal,
  );
  const totalFinalUsd = roundMoney(
    pdfPricing.totalFinalUsd ??
      quote?.total_usd ??
      pdfTotals.total_usd ??
      commercialSubtotalUsd,
  );
  const commercialMarginUsd = roundMoney(
    pdfPricing.commercialMarginUsd ??
      Math.max(totalFinalUsd - commercialSubtotalUsd, 0),
  );
  const commercialMarginPercent = Number(
    toNumber(
      pdfPricing.commercialMarginPercent ??
        deriveMarginPercent(commercialSubtotalUsd, commercialMarginUsd),
    ).toFixed(4),
  );
  const exchangeRate = roundExchangeRate(
    quote?.exchange_rate ??
      pdfTotals.exchange_rate ??
      pdfPricing.exchangeRate,
  );
  const totalFinalMxn = roundMoney(
    pdfPricing.totalFinalMxn ??
      quote?.total_mxn ??
      pdfTotals.total_mxn ??
      (exchangeRate > 0 ? totalFinalUsd * exchangeRate : 0),
  );

  return {
    commercialSubtotalUsd,
    commercialMarginUsd,
    commercialMarginPercent,
    totalFinalUsd,
    exchangeRate,
    totalFinalMxn,
  };
}

export function recalculateQuotePricing({
  breakdownRows = [],
  commercialMarginPercent = 0,
  exchangeRate = 0,
}) {
  const commercialSubtotalUsd = getBreakdownSubtotal(breakdownRows);
  const normalizedMarginPercent = Number(toNumber(commercialMarginPercent).toFixed(4));
  const commercialMarginUsd = roundMoney(
    commercialSubtotalUsd * (normalizedMarginPercent / 100),
  );
  const totalFinalUsd = roundMoney(commercialSubtotalUsd + commercialMarginUsd);
  const normalizedExchangeRate = roundExchangeRate(exchangeRate);
  const totalFinalMxn = roundMoney(
    normalizedExchangeRate > 0 ? totalFinalUsd * normalizedExchangeRate : 0,
  );

  return {
    commercialSubtotalUsd,
    commercialMarginUsd,
    commercialMarginPercent: normalizedMarginPercent,
    totalFinalUsd,
    exchangeRate: normalizedExchangeRate,
    totalFinalMxn,
  };
}

export function syncPricingFromManualTotal({
  breakdownRows = [],
  totalFinalUsd = 0,
  exchangeRate = 0,
}) {
  const commercialSubtotalUsd = getBreakdownSubtotal(breakdownRows);
  const normalizedTotalFinalUsd = roundMoney(totalFinalUsd);
  const commercialMarginUsd = roundMoney(
    Math.max(normalizedTotalFinalUsd - commercialSubtotalUsd, 0),
  );
  const commercialMarginPercent = Number(
    deriveMarginPercent(commercialSubtotalUsd, commercialMarginUsd).toFixed(4),
  );
  const normalizedExchangeRate = roundExchangeRate(exchangeRate);
  const totalFinalMxn = roundMoney(
    normalizedExchangeRate > 0 ? normalizedTotalFinalUsd * normalizedExchangeRate : 0,
  );

  return {
    commercialSubtotalUsd,
    commercialMarginUsd,
    commercialMarginPercent,
    totalFinalUsd: normalizedTotalFinalUsd,
    exchangeRate: normalizedExchangeRate,
    totalFinalMxn,
  };
}
