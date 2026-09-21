export const isHuman = (conversation) => Boolean(conversation?.transferred_to_human_at || conversation?.state === "TRANSFER_TO_HUMAN");
export const tripLabels = { ONE_WAY: "Solo ida", ROUND_TRIP: "Ida y vuelta", MULTI_CITY: "Multidestino" };
export const statusLabels = { collecting: "En captura", confirmed: "Cotización solicitada", searched: "Opciones encontradas", aircraft_selected: "Aeronave seleccionada", quoted: "Cotizada", cancelled: "Cancelada", no_aircraft_available: "Sin aeronaves disponibles" };
export function conversationLabel(conversation) {
  if (isHuman(conversation)) return "Atención humana";
  if (conversation?.state === "FINISHED") return "Finalizada";
  if (conversation?.state === "CANCELLED") return "Cancelada";
  if (["SHOW_SUMMARY", "CONFIRM_REQUEST", "EDIT_FIELD"].includes(conversation?.state)) return "Por confirmar";
  if (["SEARCH_FLIGHTS", "SHOW_RESULTS", "SELECT_AIRCRAFT", "CREATE_QUOTE"].includes(conversation?.state)) return "Cotización solicitada";
  return "En captura";
}
export function filterConversations(items, search, filter) {
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const query = normalize(search).trim();
  return items.filter((item) => {
    const matches = normalize(`${item.contact?.name || ""} ${item.contact?.phone_number || ""} ${item.last_message?.body || ""}`).includes(query);
    const finished = ["FINISHED", "CANCELLED"].includes(item.state) || !item.is_active;
    const quoted = Boolean(item.flight_request?.confirmed_at) || ["SEARCH_FLIGHTS", "SHOW_RESULTS", "SELECT_AIRCRAFT", "CREATE_QUOTE", "FINISHED"].includes(item.state);
    return matches && (filter === "all" || (filter === "human" && isHuman(item)) || (filter === "bot" && !isHuman(item) && !finished) || (filter === "quoted" && quoted) || (filter === "finished" && finished));
  });
}
export function formatTimestamp(value) {
  if (!value) return "Sin actividad";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(date);
}
export function mergeMessages(existing, incoming) {
  return [...new Map([...existing, ...incoming].map((item) => [item.id, item])).values()]
    .sort((a, b) => String(a.sent_at || "").localeCompare(String(b.sent_at || "")) || a.id - b.id);
}
