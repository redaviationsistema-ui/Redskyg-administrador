import { supabase } from "@/supabase";

export const SURVEY_STATUS_OPTIONS = [
  { value: "nuevo", label: "Nuevo" },
  { value: "revisado", label: "Revisado" },
  { value: "contactado", label: "Contactado" },
  { value: "descartado", label: "Descartado" },
];

export const SURVEY_SOURCE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "home", label: "Home" },
  { value: "contacto", label: "Contacto" },
  { value: "directo", label: "Directo" },
];

export const SURVEY_SOURCE_LABELS = {
  home: "Home",
  contacto: "Contacto",
  directo: "Directo",
};

export async function fetchSurveyResponses() {
  const { data, error } = await supabase
    .from("survey_responses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function updateSurveyResponse(id, payload) {
  const { data, error } = await supabase
    .from("survey_responses")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteSurveyResponse(id) {
  const { error } = await supabase
    .from("survey_responses")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}
