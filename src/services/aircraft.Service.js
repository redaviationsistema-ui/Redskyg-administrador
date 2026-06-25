import { supabase } from "@/supabase";

export const getAircraft = async () => {
  return await supabase.from("foto_aeronaves ").select("*").order("id", { ascending: false });
};

export const getAircraftById = async (id) => {
  return await supabase.from("foto_aeronaves ").select("*").eq("id", id).single();
};

export const createAircraft = async (data) => {
  return await supabase.from("foto_aeronaves ").insert([data]);
};

export const updateAircraft = async (id, data) => {
  return await supabase.from("foto_aeronaves ").update(data).eq("id", id);
};

export const deleteAircraft = async (id) => {
  return await supabase.from("foto_aeronaves ").delete().eq("id", id);
};
