import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL या Publishable Key नहीं मिली। .env.local जाँचें।");
}

export const supabase = createClient(
  supabaseUrl || "https://mhxdwhxerezcadfkrjhn.supabase.co",
  supabaseKey || "missing-publishable-key"
);
