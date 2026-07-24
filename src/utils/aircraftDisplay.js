import { supabase } from "@/supabase";

const EMPTY_VALUE = "-";
const aircraftNameCache = new Map();

function normalizeText(value) {
  return String(value || "").trim();
}

export function isLikelyAircraftId(value) {
  const normalized = normalizeText(value);

  if (!normalized) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized,
  );
}

export function getPreferredAircraftName(aircraftName, aircraftId, fallback = EMPTY_VALUE) {
  const normalizedName = normalizeText(aircraftName);

  if (normalizedName && !isLikelyAircraftId(normalizedName)) {
    return normalizedName;
  }

  const normalizedId = normalizeText(aircraftId);
  if (normalizedId && !isLikelyAircraftId(normalizedId)) {
    return normalizedId;
  }

  return fallback;
}

export async function resolveAircraftDisplayName({
  aircraftId,
  aircraftName,
  fallback = EMPTY_VALUE,
} = {}) {
  const preferredName = getPreferredAircraftName(aircraftName, aircraftId, "");
  if (preferredName) return preferredName;

  const normalizedId = normalizeText(aircraftId);
  if (!normalizedId) return fallback;

  if (aircraftNameCache.has(normalizedId)) {
    return aircraftNameCache.get(normalizedId) || fallback;
  }

  const { data } = await supabase
    .from("aircraft_fleet")
    .select("id, name")
    .eq("id", normalizedId)
    .maybeSingle();

  const resolvedName = normalizeText(data?.name) || fallback;
  aircraftNameCache.set(normalizedId, resolvedName);
  return resolvedName;
}
