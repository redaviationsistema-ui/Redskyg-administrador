import { supabase } from "@/supabase";

export const getAircraft = async () => {
  return await supabase.from("aircraft_fleet").select("*").order("created_at", { ascending: false });
};

export const getAircraftById = async (id) => {
  return await supabase.from("aircraft_fleet").select("*").eq("id", id).single();
};

export const createAircraft = async (data) => {
  return await supabase.from("aircraft_fleet").insert([data]);
};

export const updateAircraft = async (id, data) => {
  return await supabase.from("aircraft_fleet").update(data).eq("id", id);
};

export const deleteAircraft = async (id) => {
  return await supabase.from("aircraft_fleet").delete().eq("id", id);
};
