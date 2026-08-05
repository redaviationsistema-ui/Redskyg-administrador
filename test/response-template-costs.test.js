import test from "node:test";
import assert from "node:assert/strict";
import { calculateEstimatedCost, formatMinutes } from "../src/features/response-templates/utils/usageCosts.js";
import { normalizeReference } from "../src/features/response-templates/utils/usageReference.js";

test("calculates the requested USD cost example", () => {
  assert.equal(calculateEstimatedCost(30, 20), 10);
});

test("normalizes optional usage references", () => {
  assert.deepEqual(normalizeReference("", ""), { reference_type: null, reference_id: null });
  assert.deepEqual(normalizeReference("prospect", "123"), { reference_type: null, reference_id: null });
  assert.deepEqual(normalizeReference("client", ""), { reference_type: null, reference_id: null });
  assert.deepEqual(normalizeReference(" Quotation ", " Q-20 "), { reference_type: "quotation", reference_id: "Q-20" });
});

test("calculates the requested MXN cost example", () => {
  assert.equal(calculateEstimatedCost(90, 200), 300);
});

test("formats stored minutes", () => {
  assert.equal(formatMinutes(30), "30 min");
  assert.equal(formatMinutes(60), "1 h");
  assert.equal(formatMinutes(90), "1 h 30 min");
});
