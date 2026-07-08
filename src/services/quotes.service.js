import { supabase } from "@/supabase";

const QUOTE_SELECT = `
  *,
  quote_routes (
    id,
    quote_id,
    from_airport,
    to_airport,
    passengers,
    aircraft_id,
    estimated_price,
    start_date,
    end_date
  )
`;

export async function getQuotes() {
  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getQuoteById(id) {
  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createQuote(payload) {
  const { data, error } = await supabase
    .from("quotes")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteQuote(id) {
  const { error } = await supabase.from("quotes").delete().eq("id", id);

  if (error) throw error;
}
