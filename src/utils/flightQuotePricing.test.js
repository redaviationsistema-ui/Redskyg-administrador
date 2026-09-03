import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuoteCommercialBreakdownPresentation,
  getBreakdownSubtotal,
} from "./flightQuotePricing.js";

test("absorbs the commercial margin into Flight Cost for a standard saved quote", () => {
  const quote = {
    id: "quote-1",
    flight_cost_usd: 5903.33,
    overnight_cost_usd: 4600,
    operational_expenses_usd: 700,
    total_usd: 12883.83,
    subtotal_usd: 11203.33,
  };

  const presentation = buildQuoteCommercialBreakdownPresentation(quote, []);

  assert.equal(getBreakdownSubtotal(presentation.originalRows), 11203.33);
  assert.equal(presentation.commercialMargin, 1680.5);
  assert.equal(presentation.displayFlightCost, 7583.83);
  assert.equal(
    presentation.displayRows.find((row) => row.label === "Overnight Crew")?.displayValue,
    4600,
  );
  assert.equal(
    presentation.displayRows.find((row) => row.label === "Operational Expenses")?.displayValue,
    700,
  );
  assert.equal(presentation.displayTotal, 12883.83);
  assert.equal(
    presentation.displayRows.reduce((sum, row) => sum + row.displayValue, 0).toFixed(2),
    "12883.83",
  );
});

test("keeps additional concepts intact and only moves the margin into Flight Cost visually", () => {
  const quote = {
    id: "quote-2",
    calculation_snapshot: {
      pdfBreakdownRows: [
        { label: "Flight Cost", value: 8000 },
        { label: "Overnight Crew", value: 1200 },
        { label: "Operational Expenses", value: 300 },
        { label: "Landing Permit", value: 500.25 },
      ],
      pdfPricing: {
        commercialSubtotalUsd: 10000.25,
        commercialMarginUsd: 1500.04,
        commercialMarginPercent: 15,
        totalFinalUsd: 11500.29,
      },
    },
    flight_cost_usd: 8000,
    overnight_cost_usd: 1200,
    operational_expenses_usd: 300,
    total_usd: 11500.29,
    subtotal_usd: 10000.25,
  };

  const presentation = buildQuoteCommercialBreakdownPresentation(quote, []);

  assert.equal(getBreakdownSubtotal(presentation.originalRows), 10000.25);
  assert.equal(presentation.commercialMargin, 1500.04);
  assert.equal(presentation.displayFlightCost, 9500.04);
  assert.equal(
    presentation.displayRows.find((row) => row.label === "Landing Permit")?.displayValue,
    500.25,
  );
  assert.equal(presentation.displayTotal, 11500.29);
});

test("excludes tax rows from the commercial base and preserves total consistency", () => {
  const quote = {
    id: "quote-3",
    calculation_snapshot: {
      pdfBreakdownRows: [
        { label: "Flight Cost", value: 5000 },
        { label: "Overnight Crew", value: 900 },
        { label: "Operational Expenses", value: 100 },
        { label: "Tax (16%)", value: 960 },
      ],
      pdfPricing: {
        commercialSubtotalUsd: 6000,
        commercialMarginUsd: 900,
        commercialMarginPercent: 15,
        totalFinalUsd: 6900,
      },
    },
    flight_cost_usd: 5000,
    overnight_cost_usd: 900,
    operational_expenses_usd: 100,
    tax_amount_usd: 960,
    total_usd: 6900,
    subtotal_usd: 6000,
  };

  const presentation = buildQuoteCommercialBreakdownPresentation(quote, []);

  assert.deepEqual(
    presentation.originalRows.map((row) => row.label),
    ["Flight Cost", "Overnight Crew", "Operational Expenses"],
  );
  assert.equal(getBreakdownSubtotal(presentation.originalRows), 6000);
  assert.equal(presentation.commercialMargin, 900);
  assert.equal(presentation.displayFlightCost, 5900);
  assert.equal(presentation.displayTotal, 6900);
  assert.equal(
    presentation.displayRows.reduce((sum, row) => sum + row.displayValue, 0),
    6900,
  );
});
