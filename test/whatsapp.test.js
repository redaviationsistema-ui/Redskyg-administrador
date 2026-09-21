import test from "node:test";
import assert from "node:assert/strict";
import { createWhatsAppApi } from "../src/services/whatsappApi.js";
import { filterConversations, mergeMessages, conversationLabel, isHuman } from "../src/utils/whatsappDisplay.js";

const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
test("all six operations use the WhatsApp backend and never send credentials", async () => {
  const calls = [];
  const api = createWhatsAppApi("https://whatsapp.example/", async (url, options) => { calls.push({ url, options }); return response({ success: true, data: [] }); });
  await api.getConversations({ page: 2, per_page: 25 });
  await api.getConversation(7);
  await api.getMessages(7, { page: 3 });
  await api.sendMessage(7, "Hola");
  await api.takeoverConversation(7);
  await api.returnToBot(7);
  assert.deepEqual(calls.map(({ url }) => url), [
    "https://whatsapp.example/api/admin/whatsapp/conversations?page=2&per_page=25",
    "https://whatsapp.example/api/admin/whatsapp/conversations/7",
    "https://whatsapp.example/api/admin/whatsapp/conversations/7/messages?page=3",
    "https://whatsapp.example/api/admin/whatsapp/conversations/7/messages",
    "https://whatsapp.example/api/admin/whatsapp/conversations/7/takeover",
    "https://whatsapp.example/api/admin/whatsapp/conversations/7/return-to-bot",
  ]);
  assert.deepEqual(JSON.parse(calls[3].options.body), { body: "Hola" });
  assert.deepEqual(calls.map(({ options }) => options.method), ["GET", "GET", "GET", "POST", "POST", "POST"]);
  assert.ok(calls.every(({ options }) => options.credentials === "omit" && !options.headers.Authorization));
});
test("failed sends surface server errors and do not retry POST", async () => {
  let calls = 0;
  const api = createWhatsAppApi("https://whatsapp.example", async () => { calls++; return response({ success: false, message: "No fue posible enviar el mensaje" }, 502); });
  await assert.rejects(api.sendMessage(1, "Hola"), /No fue posible enviar/);
  assert.equal(calls, 1);
});
test("invalid JSON, missing data, missing configuration and network errors are actionable", async () => {
  await assert.rejects(createWhatsAppApi("").getConversations(), /configuró/);
  await assert.rejects(createWhatsAppApi("https://example.com", async () => ({ json: async () => { throw new Error(); } })).getConversations(), /formato/);
  await assert.rejects(createWhatsAppApi("https://example.com", async () => response({ success: true })).getConversations(), /datos/);
  await assert.rejects(createWhatsAppApi("https://example.com", async () => { throw new TypeError("Failed to fetch"); }).getConversations(), /conectar/);
});
test("rate limiting and cancelled selection propagate correctly", async () => {
  await assert.rejects(createWhatsAppApi("https://example.com", async () => response({ success: false }, 429)).getConversations(), /Demasiadas/);
  const controller = new AbortController();
  const api = createWhatsAppApi("https://example.com", async (_, { signal }) => {
    controller.abort();
    assert.equal(signal.aborted, true);
    throw new DOMException("Aborted", "AbortError");
  });
  await assert.rejects(api.getMessages(1, { signal: controller.signal }), { name: "AbortError" });
});
test("search ignores accents and filters bot, human, quotations and finished conversations", () => {
  const items = [
    { id: 1, is_active: true, state: "ASK_EMAIL", contact: { name: "José", phone_number: "52155" } },
    { id: 2, is_active: true, state: "TRANSFER_TO_HUMAN", transferred_to_human_at: "2026-10-01" },
    { id: 3, is_active: true, state: "SELECT_AIRCRAFT" },
    { id: 4, is_active: true, state: "FINISHED" },
  ];
  assert.deepEqual(filterConversations(items, "jose", "all").map(x => x.id), [1]);
  assert.deepEqual(filterConversations(items, "", "human").map(x => x.id), [2]);
  assert.deepEqual(filterConversations(items, "", "bot").map(x => x.id), [1, 3]);
  assert.deepEqual(filterConversations(items, "", "quoted").map(x => x.id), [3, 4]);
  assert.deepEqual(filterConversations(items, "", "finished").map(x => x.id), [4]);
  assert.equal(isHuman(items[1]), true);
  assert.equal(conversationLabel(items[3]), "Finalizada");
});
test("message refresh updates delivery status without duplicates and preserves chronology", () => {
  const first = { id: 1, sent_at: "2026-10-01T10:00:00Z", status: "sent" };
  const last = { id: 2, sent_at: "2026-10-01T11:00:00Z" };
  assert.deepEqual(mergeMessages([last, first], [{ ...first, status: "read" }]), [{ ...first, status: "read" }, last]);
});
