/**
 * The SAME Supabase project the app signs into — one account, two surfaces.
 * The anon key is public by design; Row Level Security is the boundary.
 * Values verbatim from the app's lib/supabase.ts.
 */
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://tlrkkciovzjzqsjoacus.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRscmtrY2lvdnpqenFzam9hY3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTYxNzUsImV4cCI6MjA4ODEzMjE3NX0.-jTXO4LWpqtLsyF_v--oC9myaEAEEEnO26v7KPb5DI0";

// Session persistence is EXPLICIT: signed in once on a device stays signed
// in (localStorage + auto-refresh); PKCE makes the emailed links exchange a
// code server-side rather than shipping tokens in the URL fragment.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
