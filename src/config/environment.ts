const environment = import.meta.env ?? {};

export const SUPABASE_URL = environment.VITE_SUPABASE_URL || "";
export const SUPABASE_PUBLISHABLE_KEY =
  environment.VITE_SUPABASE_PUBLISHABLE_KEY || "";
