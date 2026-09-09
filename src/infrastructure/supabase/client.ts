import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "../../config/environment";

let client: SupabaseClient | undefined;

const configuredValue = (value: string) =>
  Boolean(value && !value.includes("PASTE_") && !value.includes("YOUR_"));

export const isSupabaseConfigured = () =>
  configuredValue(SUPABASE_URL) && configuredValue(SUPABASE_PUBLISHABLE_KEY);

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase has not been connected yet.");
  }

  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return client;
}
