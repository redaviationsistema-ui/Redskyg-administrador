<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import WhatsAppFlightPanel from "@/components/whatsapp/WhatsAppFlightPanel.vue";
import { usePagination } from "@/composables/usePagination";
import * as api from "@/services/whatsappApi";
import { conversationLabel, filterConversations, formatTimestamp, isHuman, mergeMessages } from "@/utils/whatsappDisplay";

const conversations = ref([]);
const search = ref("");
const filter = ref("all");
const listLoading = ref(false);
const listError = ref("");
const selectedId = ref(null);
const conversation = ref(null);
const summary = ref("");
const messages = ref([]);
const chatLoading = ref(false);
const chatError = ref("");
const actionError = ref("");
const sending = ref(false);
const controlling = ref(false);
const drafts = ref({});
const historyPage = ref(1);
const historyLoading = ref(false);
const chatLog = ref(null);
const refreshActive = ref(false);
let listController;
let chatController;
let generation = 0;
let disposed = false;
let pollTimer;

const filters = [{ id: "all", label: "Todas" }, { id: "bot", label: "Bot activo" }, { id: "human", label: "Atención humana" }, { id: "quoted", label: "Cotización solicitada" }, { id: "finished", label: "Finalizadas" }];
const filtered = computed(() => filterConversations(conversations.value, search.value, filter.value));
const { currentPage, totalPages, paginatedItems, nextPage, prevPage } = usePagination(filtered, 12);
const draft = computed({ get: () => drafts.value[selectedId.value] || "", set: (value) => { drafts.value[selectedId.value] = value; } });
const human = computed(() => isHuman(conversation.value));
const busy = computed(() => sending.value || controlling.value);
const deliveryLabels = { sent: "Enviado", delivered: "Entregado", read: "Leído", failed: "Fallido" };
watch([search, filter], () => { currentPage.value = 1; });
watch(totalPages, (pages) => { currentPage.value = Math.min(currentPage.value, Math.max(1, pages)); });

function updateList(item) {
  conversations.value = conversations.value.map((existing) => existing.id === item.id ? { ...existing, ...item } : existing)
    .sort((a, b) => String(b.last_message_at || "").localeCompare(String(a.last_message_at || "")) || b.id - a.id);
}
async function loadConversations() {
  listController?.abort();
  const controller = new AbortController();
  listController = controller;
  listLoading.value = true;
  listError.value = "";
  try {
    const first = await api.getConversations({ per_page: 100, signal: controller.signal });
    if (!Array.isArray(first.data)) throw new Error("La lista de conversaciones no tiene un formato válido.");
    const all = [...first.data];
    for (let page = 2; page <= (first.meta?.last_page || 1); page++) {
      const result = await api.getConversations({ page, per_page: 100, signal: controller.signal });
      all.push(...result.data);
    }
    if (controller.signal.aborted || disposed) return;
    conversations.value = [...new Map(all.map((item) => [item.id, item])).values()];
    if (conversation.value) updateList(conversation.value);
  } catch (error) {
    if (!controller.signal.aborted && !disposed) listError.value = error.message;
  } finally {
    if (listController === controller) listLoading.value = false;
  }
}
async function latestMessages(id, signal) {
  const first = await api.getMessages(id, { per_page: 50, signal });
  const last = first.meta?.last_page || 1;
  return { result: last > 1 ? await api.getMessages(id, { per_page: 50, page: last, signal }) : first, page: last };
}
async function scrollToBottom() {
  await nextTick();
  if (chatLog.value) chatLog.value.scrollTop = chatLog.value.scrollHeight;
}
async function selectConversation(id) {
  if (busy.value) return;
  chatController?.abort();
  chatController = new AbortController();
  const signal = chatController.signal;
  const version = ++generation;
  selectedId.value = id;
  conversation.value = null;
  summary.value = "";
  messages.value = [];
  chatLoading.value = true;
  chatError.value = "";
  actionError.value = "";
  historyPage.value = 1;
  historyLoading.value = false;
  refreshActive.value = false;
  try {
    const [detail, history] = await Promise.all([api.getConversation(id, { signal }), latestMessages(id, signal)]);
    if (version !== generation || disposed) return;
    conversation.value = detail.data;
    summary.value = detail.summary || "";
    messages.value = mergeMessages([], history.result.data);
    historyPage.value = history.page;
    updateList(detail.data);
    await scrollToBottom();
  } catch (error) {
    if (version === generation && !signal.aborted) chatError.value = error.message;
  } finally {
    if (version === generation) chatLoading.value = false;
  }
}
async function loadOlder() {
  if (historyLoading.value || historyPage.value <= 1 || busy.value) return;
  const version = generation;
  const oldHeight = chatLog.value?.scrollHeight || 0;
  historyLoading.value = true;
  try {
    const result = await api.getMessages(selectedId.value, { page: historyPage.value - 1, per_page: 50, signal: chatController.signal });
    if (version !== generation || disposed) return;
    messages.value = mergeMessages(messages.value, result.data);
    historyPage.value--;
    chatError.value = "";
    await nextTick();
    if (chatLog.value) chatLog.value.scrollTop += chatLog.value.scrollHeight - oldHeight;
  } catch (error) {
    if (version === generation && !disposed) chatError.value = error.message;
  } finally { if (version === generation) historyLoading.value = false; }
}
async function refreshChat() {
  if (!conversation.value || chatLoading.value || busy.value || refreshActive.value || historyLoading.value) return;
  const version = generation;
  const id = selectedId.value;
  const signal = chatController.signal;
  const atBottom = !chatLog.value || chatLog.value.scrollHeight - chatLog.value.scrollTop - chatLog.value.clientHeight < 80;
  refreshActive.value = true;
  try {
    const detail = await api.getConversation(id, { signal });
    const updated = [];
    let lastPage = historyPage.value;
    for (let page = historyPage.value; page <= lastPage; page++) {
      const result = await api.getMessages(id, { page, per_page: 50, signal });
      updated.push(...result.data);
      lastPage = result.meta?.last_page || 1;
    }
    if (version !== generation || disposed || busy.value) return;
    conversation.value = detail.data;
    summary.value = detail.summary || "";
    messages.value = mergeMessages(messages.value, updated);
    updateList(detail.data);
    chatError.value = "";
    if (atBottom) await scrollToBottom();
  } catch (error) {
    if (version === generation && !signal.aborted && !disposed) chatError.value = error.message;
  } finally { if (version === generation) refreshActive.value = false; }
}
async function send() {
  const body = draft.value.trim();
  if (!body || body.length > 4096 || busy.value || !conversation.value || refreshActive.value) return;
  const id = selectedId.value;
  const originalDraft = draft.value;
  sending.value = true;
  actionError.value = "";
  try {
    const result = await api.sendMessage(id, body);
    if (disposed) return;
    messages.value = mergeMessages(messages.value, [result.data]);
    if (drafts.value[id] === originalDraft) drafts.value[id] = "";
    updateList({ id, last_message: result.data, last_message_at: result.data.sent_at });
    await scrollToBottom();
  } catch (error) { if (!disposed) actionError.value = error.message; }
  finally { sending.value = false; }
}
async function toggleControl() {
  if (!conversation.value || busy.value || refreshActive.value) return;
  controlling.value = true;
  actionError.value = "";
  try {
    const result = await (human.value ? api.returnToBot(selectedId.value) : api.takeoverConversation(selectedId.value));
    if (disposed) return;
    conversation.value = { ...conversation.value, ...result.data };
    updateList(result.data);
  } catch (error) { if (!disposed) actionError.value = error.message; }
  finally { controlling.value = false; }
}
onMounted(() => {
  loadConversations();
  pollTimer = setInterval(() => { if (!document.hidden) refreshChat(); }, 15000);
});
onBeforeUnmount(() => {
  disposed = true;
  generation++;
  clearInterval(pollTimer);
  listController?.abort();
  chatController?.abort();
});
</script>

<template>
  <div class="whatsapp-page">
    <header class="page-heading">
      <div><p class="eyebrow">Centro de atención</p><h1>WhatsApp</h1><p class="muted">Conversaciones y solicitudes de vuelo en un solo lugar.</p></div>
      <BaseButton variant="secondary" :disabled="listLoading || busy" @click="loadConversations">{{ listLoading ? "Actualizando…" : "Actualizar conversaciones" }}</BaseButton>
    </header>
    <nav class="filters" aria-label="Filtrar conversaciones">
      <button v-for="item in filters" :key="item.id" type="button" :aria-pressed="filter === item.id" :class="{ active: filter === item.id }" @click="filter = item.id">{{ item.label }}</button>
    </nav>
    <div class="workspace">
      <section class="conversation-list" aria-label="Conversaciones" :aria-busy="listLoading">
        <div class="list-heading"><h2>Conversaciones <span>{{ filtered.length }}</span></h2><label class="sr-only" for="whatsapp-search">Buscar por nombre, teléfono o mensaje</label><input id="whatsapp-search" v-model="search" type="search" placeholder="Nombre, teléfono o mensaje"></div>
        <div v-if="listError" class="error" role="alert">{{ listError }}<button type="button" @click="loadConversations">Reintentar</button></div>
        <p v-if="listLoading" class="empty" role="status">Cargando conversaciones…</p>
        <p v-else-if="!filtered.length && !listError" class="empty">{{ search || filter !== 'all' ? "No hay coincidencias con estos filtros." : "Aún no hay conversaciones de WhatsApp." }}</p>
        <div class="conversation-items">
          <button v-for="item in paginatedItems" :key="item.id" type="button" class="conversation-item" :class="{ selected: selectedId === item.id }" :aria-pressed="selectedId === item.id" :disabled="busy" @click="selectConversation(item.id)">
            <span class="contact-title">{{ item.contact?.name || item.contact?.phone_number || 'Sin nombre' }}</span>
            <span class="muted">{{ item.contact?.phone_number }}</span>
            <span class="preview">{{ item.last_message?.body || (item.last_message ? `[${item.last_message.type}]` : "Sin mensajes") }}</span>
            <span class="badge" :class="{ human: isHuman(item) }">{{ conversationLabel(item) }}</span>
            <span class="activity">{{ formatTimestamp(item.last_message_at) }} · {{ isHuman(item) ? 'Humano' : 'Bot' }}</span>
          </button>
        </div>
        <footer v-if="totalPages > 1" class="pagination"><BaseButton variant="secondary" :disabled="currentPage <= 1" @click="prevPage">Anterior</BaseButton><span>{{ currentPage }} / {{ totalPages }}</span><BaseButton variant="secondary" :disabled="currentPage >= totalPages" @click="nextPage">Siguiente</BaseButton></footer>
      </section>
      <section class="chat-panel" aria-label="Chat" :aria-busy="chatLoading">
        <p v-if="!selectedId" class="empty welcome">Selecciona una conversación para ver sus mensajes y la solicitud de vuelo.</p>
        <p v-else-if="chatLoading" class="empty" role="status">Cargando conversación…</p>
        <template v-else>
          <div v-if="chatError" class="error" role="alert">{{ chatError }}<button type="button" :disabled="refreshActive" @click="conversation ? refreshChat() : selectConversation(selectedId)">Reintentar</button></div>
          <template v-if="conversation">
            <header class="chat-heading"><div><h2>{{ conversation.contact?.name || conversation.contact?.phone_number }}</h2><span class="badge" :class="{ human }">{{ human ? 'Atención humana' : 'Bot activo' }}</span></div><BaseButton variant="secondary" :disabled="busy || refreshActive" @click="toggleControl">{{ controlling ? 'Guardando…' : human ? 'Devolver al bot' : 'Tomar conversación' }}</BaseButton></header>
            <div class="chat-toolbar"><span class="muted">Fechas y horas de mensajes en tu zona local.</span><button type="button" :disabled="refreshActive || busy" @click="refreshChat">{{ refreshActive ? 'Actualizando…' : 'Actualizar chat' }}</button></div>
            <div ref="chatLog" class="messages" role="log" aria-label="Historial de mensajes" aria-live="polite">
              <BaseButton v-if="historyPage > 1" variant="secondary" :disabled="historyLoading || busy || refreshActive" @click="loadOlder">{{ historyLoading ? 'Cargando…' : 'Cargar mensajes anteriores' }}</BaseButton>
              <p v-if="!messages.length" class="empty">Esta conversación aún no tiene mensajes.</p>
              <article v-for="message in messages" :key="message.id" class="message" :class="{ outbound: message.direction === 'outbound' }">
                <span class="message-author">{{ message.direction === 'outbound' ? 'Sky Group' : conversation.contact?.name || 'Cliente' }}</span>
                <p>{{ message.body || `Mensaje de tipo ${message.type}` }}</p>
                <footer><time :datetime="message.sent_at">{{ formatTimestamp(message.sent_at) }}</time><span v-if="message.direction === 'outbound' && message.status" :class="{ failed: message.status === 'failed' }">{{ deliveryLabels[message.status] || message.status }}</span></footer>
                <small v-if="message.status === 'failed' && message.error_message" class="failed">{{ message.error_message }}</small>
              </article>
            </div>
            <form class="composer" @submit.prevent="send">
              <p v-if="!human" class="muted">El bot está activo. Puedes tomar la conversación para responder manualmente.</p>
              <p v-if="actionError" class="error" role="alert">{{ actionError }}</p>
              <label for="whatsapp-reply">Mensaje</label><textarea id="whatsapp-reply" v-model="draft" rows="3" maxlength="4096" :disabled="sending" placeholder="Escribe tu respuesta…"></textarea>
              <div class="composer-actions"><span class="muted">{{ draft.length }} / 4096</span><BaseButton type="submit" :disabled="!draft.trim() || busy || refreshActive">{{ sending ? 'Enviando…' : 'Enviar mensaje' }}</BaseButton></div>
            </form>
          </template>
        </template>
      </section>
      <WhatsAppFlightPanel v-if="conversation && !chatLoading" :conversation="conversation" :summary="summary" />
      <aside v-else class="empty flight-placeholder">Los datos del cliente y del vuelo aparecerán aquí.</aside>
    </div>
  </div>
</template>

<style scoped>
.whatsapp-page { display: flex; flex-direction: column; gap: 18px; color: var(--text-main); }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
h1 { margin: 4px 0; font-size: 1.8rem; color: var(--text-strong); } h2 { margin: 0; font-size: 1rem; overflow-wrap: anywhere; }
.eyebrow { color: var(--primary); text-transform: uppercase; font-size: .72rem; font-weight: 800; letter-spacing: .12em; margin: 0; }
.muted { color: var(--text-muted); font-size: .82rem; } .page-heading p { margin: 6px 0; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; }
.filters button { padding: 10px 16px; border-radius: 20px; background: var(--bg-surface-solid); color: var(--text-muted); border: 1px solid var(--border-color); cursor: pointer; font: inherit; font-size: .85rem; }
.filters button.active { color: var(--primary); background: var(--primary-soft); border-color: var(--primary); }
.workspace { display: grid; grid-template-columns: minmax(230px, .9fr) minmax(320px, 1.7fr) minmax(260px, 1fr); min-height: 650px; height: calc(100dvh - 250px); max-height: 1000px; background: var(--bg-surface-solid); border: 1px solid var(--border-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
.conversation-list { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--border-color); }
.list-heading { padding: 18px; } .list-heading h2 { margin-bottom: 14px; } h2 span { color: var(--text-muted); font-weight: 400; }
input, textarea { width: 100%; border: 1px solid var(--border-strong); background: var(--bg-soft); border-radius: 12px; padding: 12px; color: var(--text-main); font: inherit; font-size: .85rem; } textarea { resize: vertical; max-height: 180px; }
button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.conversation-items { flex: 1; overflow: auto; }
.conversation-item { display: flex; flex-direction: column; text-align: left; width: 100%; gap: 7px; padding: 16px 18px; background: transparent; border: 0; border-bottom: 1px solid var(--border-color); color: var(--text-main); cursor: pointer; font: inherit; }
.conversation-item:hover { background: var(--bg-hover); } .conversation-item.selected { background: var(--primary-soft); box-shadow: inset 3px 0 var(--primary); }
.contact-title { font-weight: 750; overflow-wrap: anywhere; }.preview { font-size: .85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; color: var(--text-muted); }
.activity { font-size: .7rem; color: var(--text-muted); }.badge { width: fit-content; padding: 4px 8px; border-radius: 10px; background: var(--bg-muted); color: var(--primary); font-size: .72rem; font-weight: 700; }.badge.human { color: var(--warning); }
.pagination { padding: 12px; display: flex; align-items: center; justify-content: space-between; gap: 5px; font-size: .75rem; }.pagination :deep(button) { font-size: .72rem; padding: 0 8px; }
.chat-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--bg-soft); border-right: 1px solid var(--border-color); }
.chat-heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 18px; background: var(--bg-surface-solid); }.chat-heading .badge { display: inline-block; margin-top: 8px; }.chat-heading :deep(button) { font-size: .78rem; padding: 0 12px; flex-shrink: 0; }
.chat-toolbar { display: flex; justify-content: space-between; gap: 8px; padding: 10px 18px; }.chat-toolbar button, .error button { background: transparent; border: 0; color: var(--primary); cursor: pointer; text-decoration: underline; }
.messages { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; padding: 20px; }
.message { max-width: 86%; padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 16px 16px 16px 4px; background: var(--bg-surface-solid); box-shadow: var(--shadow-sm); overflow-wrap: anywhere; }
.message.outbound { align-self: flex-end; background: var(--primary-soft); border-radius: 16px 16px 4px 16px; }.message p { white-space: pre-wrap; font-size: .88rem; line-height: 1.55; margin: 8px 0; }.message-author { font-size: .72rem; font-weight: 750; color: var(--primary); }.message footer { display: flex; flex-wrap: wrap; gap: 10px; font-size: .67rem; color: var(--text-muted); }
.composer { padding: 16px 18px; border-top: 1px solid var(--border-color); background: var(--bg-surface-solid); }.composer label { display: block; font-size: .8rem; margin-bottom: 8px; font-weight: 700; }.composer-actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; }.composer p { margin: 0 0 10px; }
.empty { padding: 24px; color: var(--text-muted); text-align: center; font-size: .9rem; line-height: 1.6; }.welcome { margin: auto; max-width: 350px; }.error { padding: 12px; color: var(--danger); font-size: .85rem; background: var(--bg-surface-solid); overflow-wrap: anywhere; }.failed { color: var(--danger); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@media (max-width: 1350px) { .workspace { grid-template-columns: 240px minmax(0, 1fr); height: auto; max-height: none; }.conversation-list, .chat-panel { height: 700px; }.workspace :deep(.flight-panel), .flight-placeholder { grid-column: 1 / -1; border-top: 1px solid var(--border-color); }.chat-heading { flex-wrap: wrap; } }
@media (max-width: 700px) { .workspace { grid-template-columns: minmax(0, 1fr); }.conversation-list { height: 370px; border-right: 0; border-bottom: 1px solid var(--border-color); }.chat-panel { height: 680px; border-right: 0; }.chat-toolbar { flex-wrap: wrap; }.messages { padding: 14px; }.message { max-width: 94%; }.page-heading :deep(button) { width: 100%; } }
</style>
