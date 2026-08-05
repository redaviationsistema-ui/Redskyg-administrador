import test from "node:test";
import assert from "node:assert/strict";
import { displayContentToTechnical, extractTemplateVariables, getTemplateVariableOptions, insertVariableAtCursor, renderTemplate, technicalContentToDisplay, validateTemplateVariables } from "../src/features/response-templates/utils/templateVariables.js";

test("renders allowed variables without leaking nullish values", () => {
  const result = renderTemplate("Hola {{client_name}} / {{company_name}}", { client_name: "Ana", company_name: null });
  assert.equal(result.message, "Hola Ana / {{company_name}}");
  assert.deepEqual(result.pending, ["company_name"]);
  assert.equal(result.message.includes("null"), false);
});
test("exposes bilingual labels while preserving technical tokens", () => {
  const spanish = getTemplateVariableOptions("es")[0];
  const english = getTemplateVariableOptions("en")[0];
  assert.deepEqual([spanish.label, english.label, spanish.token], ["Nombre del cliente", "Client name", "{{client_name}}"]);
});
test("inserts a token at the selection and replaces selected text", () => {
  const result = insertVariableAtCursor({ selectionStart: 5, selectionEnd: 10 }, "Hola XXXXX mundo", "{{client_name}}");
  assert.equal(result.value, "Hola {{client_name}} mundo");
  assert.equal(result.cursor, 20);
});
test("shows friendly field names while preserving tokens for persistence", () => {
  const display = technicalContentToDisplay("Hola {{client_name}} de {{company_name}}", "es");
  assert.equal(display, "Hola [Nombre del cliente] de [Nombre de la empresa]");
  assert.equal(displayContentToTechnical(display), "Hola {{client_name}} de {{company_name}}");
});
test("detects and validates variables centrally", () => {
  assert.deepEqual(extractTemplateVariables("{{route}} {{route}} {{bad_key}}"), ["route", "bad_key"]);
  assert.deepEqual(validateTemplateVariables("{{route}} {{bad_key}}"), ["bad_key"]);
});
