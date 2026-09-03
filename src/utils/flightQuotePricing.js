function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toCents(value) {
  return Math.round(roundMoney(value) * 100);
}

function fromCents(value) {
  return Number((Number(value || 0) / 100).toFixed(2));
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

export function isTaxBreakdownLabel(label) {
  return /tax|iva|impuesto/i.test(String(label || ""));
}

export function getOriginalCommercialBreakdownRows(quote, customerRoutes = []) {
  const customRows = quote?.calculation_snapshot?.pdfBreakdownRows;

  if (Array.isArray(customRows) && customRows.length) {
    const filteredRows = customRows
      .filter((row) => String(row?.label || "").trim() && !isTaxBreakdownLabel(row?.label))
      .map((row) => ({
        label: String(row.label || "Concept").trim(),
        value: roundMoney(row.value || 0),
      }));

    if (filteredRows.length) {
      const hasLabel = (pattern) =>
        filteredRows.some((row) => pattern.test(String(row.label || "")));

      const normalizedRows = [...filteredRows];

      if (!hasLabel(/flight\s*cost/i) && Number(quote?.flight_cost_usd || 0) > 0) {
        normalizedRows.unshift({
          label: "Flight Cost",
          value: roundMoney(quote.flight_cost_usd || 0),
        });
      }

      if (!hasLabel(/overnight/i) && Number(quote?.overnight_cost_usd || 0) > 0) {
        normalizedRows.push({
          label: "Overnight Crew",
          value: roundMoney(quote.overnight_cost_usd || 0),
        });
      }

      if (
        !hasLabel(/operational/i) &&
        Number(quote?.operational_expenses_usd || 0) > 0
      ) {
        normalizedRows.push({
          label: "Operational Expenses",
          value: roundMoney(quote.operational_expenses_usd || 0),
        });
      }

      return normalizedRows;
    }
  }

  if (quote?.id || quote?.flight_cost_usd != null) {
    return [
      { label: "Flight Cost", value: roundMoney(quote?.flight_cost_usd || 0) },
      { label: "Overnight Crew", value: roundMoney(quote?.overnight_cost_usd || 0) },
      {
        label: "Operational Expenses",
        value: roundMoney(quote?.operational_expenses_usd || 0),
      },
    ];
  }

  const flightCost = customerRoutes.reduce(
    (sum, item) => sum + (Number(item?.estimated_price) || 0),
    0,
  );
  const total = Number(quote?.total_estimated_price ?? flightCost) || 0;
  const operationalExpenses = Math.max(total - flightCost, 0);

  return [
    { label: "Flight Cost", value: roundMoney(flightCost) },
    { label: "Overnight Crew", value: 0 },
    { label: "Operational Expenses", value: roundMoney(operationalExpenses) },
  ];
}

export function buildCommercialBreakdownPresentation({
  breakdownRows = [],
  commercialMarginUsd = null,
  commercialMarginPercent = 0,
}) {
  const normalizedRows = breakdownRows
    .filter((row) => String(row?.label || "").trim())
    .map((row) => ({
      label: String(row.label || "Concept").trim(),
      originalValue: roundMoney(row.value || 0),
    }));

  const baseSubtotalCents = normalizedRows.reduce(
    (sum, row) => sum + toCents(row.originalValue),
    0,
  );
  const marginCents =
    commercialMarginUsd != null
      ? toCents(commercialMarginUsd)
      : Math.round(
          baseSubtotalCents * (toNumber(commercialMarginPercent).toFixed(4) / 100),
        );
  const flightCostIndex = normalizedRows.findIndex((row) =>
    /flight\s*cost/i.test(row.label),
  );
  const marginTargetIndex = flightCostIndex >= 0 ? flightCostIndex : 0;

  const displayRows = normalizedRows.map((row, index) => {
    const displayValueCents =
      index === marginTargetIndex
        ? toCents(row.originalValue) + marginCents
        : toCents(row.originalValue);

    return {
      label: row.label,
      originalValue: row.originalValue,
      displayValue: fromCents(displayValueCents),
    };
  });

  return {
    baseSubtotal: fromCents(baseSubtotalCents),
    commercialMargin: fromCents(marginCents),
    displayFlightCost:
      marginTargetIndex >= 0 ? displayRows[marginTargetIndex]?.displayValue || 0 : 0,
    displayRows,
    displayTotal: fromCents(
      displayRows.reduce((sum, row) => sum + toCents(row.displayValue), 0),
    ),
  };
}

export function buildQuoteCommercialBreakdownPresentation(quote, customerRoutes = []) {
  const originalRows = getOriginalCommercialBreakdownRows(quote, customerRoutes);
  const pricing = resolveQuotePricing(quote, originalRows);

  return {
    originalRows,
    pricing,
    ...buildCommercialBreakdownPresentation({
      breakdownRows: originalRows,
      commercialMarginUsd: pricing.commercialMarginUsd,
      commercialMarginPercent: pricing.commercialMarginPercent,
    }),
  };
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
