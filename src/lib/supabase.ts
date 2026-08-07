import { createClient } from "@supabase/supabase-js";

// Server-only client, used by API routes and server components. Uses the service
// role key because this is a three-internal-staff tool with no end-user auth
// (Step 6 explicitly cuts user accounts/permissions from MVP scope) — every write
// goes through our own API routes, never directly from the browser.
export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY environment variables."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
