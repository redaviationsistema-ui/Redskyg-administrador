import test from "node:test";
import assert from "node:assert/strict";

import {
  recalculateQuotePricing,
  resolveQuotePricing,
} from "../src/utils/flightQuotePricing.js";

test("preserves stored quote totals when opening the editor without price changes", () => {
  const breakdownRows = [
    { label: "Flight Cost", value: 9600 },
    { label: "Overnight Crew", value: 2400 },
    { label: "Operational Expenses", value: 950 },
  ];

  const quote = {
    subtotal_usd: 12950,
    total_usd: 14892.5,
    exchange_rate: 17.42,
    total_mxn: 259427.35,
    calculation_snapshot: {},
  };

  const pricing = resolveQuotePricing(quote, breakdownRows);

  assert.equal(pricing.commercialSubtotalUsd, 12950);
  assert.equal(pricing.commercialMarginPercent, 15);
  assert.equal(pricing.commercialMarginUsd, 1942.5);
  assert.equal(pricing.totalFinalUsd, 14892.5);
  assert.equal(pricing.exchangeRate, 17.42);
  assert.equal(pricing.totalFinalMxn, 259427.35);
});

test("recalculates totals from breakdown and commercial margin percent", () => {
  const pricing = recalculateQuotePricing({
    breakdownRows: [
      { label: "Flight Cost", value: 9600 },
      { label: "Overnight Crew", value: 2400 },
      { label: "Operational Expenses", value: 950 },
    ],
    commercialMarginPercent: 15,
    exchangeRate: 17.42,
  });

  assert.equal(pricing.commercialSubtotalUsd, 12950);
  assert.equal(pricing.commercialMarginUsd, 1942.5);
  assert.equal(pricing.totalFinalUsd, 14892.5);
  assert.equal(pricing.totalFinalMxn, 259427.35);
});
